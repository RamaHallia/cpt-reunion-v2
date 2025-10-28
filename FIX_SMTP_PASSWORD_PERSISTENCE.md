# 🔐 FIX : Persistance du Mot de Passe SMTP

## 🔴 **Problèmes**

1. ❌ **Le mot de passe SMTP n'est pas enregistré** ou disparaît après refresh
2. ❌ **Le champ reste bleu** (autofill du navigateur) au lieu d'afficher l'état réel
3. ❌ **L'utilisateur ne sait pas** si un mot de passe existe déjà

---

## 🔍 **Causes des Bugs**

### **Problème 1 : Mot de passe toujours vidé au chargement**

**Ligne 80 (avant)** dans `Settings.tsx` :
```typescript
const loadSettings = async () => {
  const { data } = await supabase
    .from('user_settings')
    .select('..., smtp_user, smtp_secure, ...')  // ❌ Pas smtp_password_encrypted
    .eq('user_id', userId)
    .maybeSingle();

  if (data) {
    setSmtpPassword('');  // ❌ TOUJOURS VIDÉ
  }
};
```

**Résultat** :
- ✅ Mot de passe **enregistré dans la DB** (chiffré)
- ❌ Mais **toujours affiché comme vide** dans le formulaire
- ❌ User pense que rien n'a été enregistré

---

### **Problème 2 : Autofill du navigateur**

```html
<input
  type="password"
  value={smtpPassword}
  placeholder="••••••••"
  className="..."
/>
<!-- ❌ Pas d'attributs pour bloquer l'autofill -->
```

**Résultat** :
- 🔵 **Champ bleu** (autofill navigateur)
- ❌ Conflit entre l'état React (`smtpPassword = ''`) et l'autofill
- ❌ User ne voit pas le vrai état

---

### **Problème 3 : Sauvegarde systématique**

```typescript
// Avant (ligne 218)
if (smtpPassword && smtpPassword.trim() !== '') {
  // Chiffrer et sauvegarder
}
```

**Problème** :
- Si l'utilisateur modifie juste la signature, le mot de passe est **re-chiffré** inutilement
- Si le champ est vide (`''`), on pense qu'il n'y a pas de mot de passe → perte !

---

## ✅ **Solutions Appliquées**

### **1️⃣ Détection du mot de passe existant**

**Fichier** : `src/components/Settings.tsx`

#### **A. Nouveaux états**
```typescript
const [isPasswordModified, setIsPasswordModified] = useState(false);
const [hasExistingPassword, setHasExistingPassword] = useState(false);
```

#### **B. Chargement avec indication**
```typescript
const loadSettings = async () => {
  const { data } = await supabase
    .from('user_settings')
    .select('..., smtp_password_encrypted, ...')  // ✅ Inclure la colonne
    .eq('user_id', userId)
    .maybeSingle();

  if (data) {
    // Si un mot de passe chiffré existe, afficher un placeholder
    if (data.smtp_password_encrypted) {
      setSmtpPassword('••••••••••••'); // ✅ Placeholder visuel
      setHasExistingPassword(true);    // ✅ Flag pour savoir
    } else {
      setSmtpPassword('');
      setHasExistingPassword(false);
    }
    setIsPasswordModified(false); // Reset
  }
};
```

**Résultat** :
```
[Mot de passe: ••••••••••••]  (gris, pas bleu)
✓ Mot de passe enregistré. Laissez vide pour le conserver.
```

---

### **2️⃣ Désactivation de l'autofill**

**Fichier** : `src/components/Settings.tsx`

```tsx
<input
  type={showPassword ? "text" : "password"}
  value={smtpPassword}
  onChange={(e) => {
    setSmtpPassword(e.target.value);
    setIsPasswordModified(true);  // ✅ Marquer comme modifié
  }}
  onFocus={() => {
    // Vider le placeholder au focus si mot de passe existe
    if (hasExistingPassword && !isPasswordModified) {
      setSmtpPassword('');
    }
  }}
  placeholder={hasExistingPassword && !isPasswordModified 
    ? "••••••••••••" 
    : "Nouveau mot de passe"}
  autoComplete="new-password"      // ✅ Bloquer autofill
  data-form-type="other"           // ✅ Hint au navigateur
  className="..."
/>
```

**Résultat** :
- ✅ **Pas de champ bleu** (autofill désactivé)
- ✅ **Placeholder clair** selon l'état
- ✅ **Vide au focus** si mot de passe existant (pour saisie nouveau)

---

### **3️⃣ Sauvegarde conditionnelle**

**Fichier** : `src/components/Settings.tsx`

```typescript
const handleSave = async () => {
  // ...
  
  let passwordUpdate = {};
  
  // Seulement si le mot de passe a été MODIFIÉ et n'est pas le placeholder
  if (isPasswordModified && 
      smtpPassword && 
      smtpPassword.trim() !== '' && 
      smtpPassword !== '••••••••••••') {
    
    console.log('🔐 Chiffrement du nouveau mot de passe SMTP...');
    
    const { data: encryptedPassword, error } = await supabase
      .rpc('encrypt_smtp_password', {
        password: smtpPassword,
        user_id: userId
      });
    
    if (error) throw new Error('Impossible de chiffrer le mot de passe SMTP');
    
    passwordUpdate = {
      smtp_password_encrypted: encryptedPassword,
      smtp_password: null
    };
    
    console.log('✅ Mot de passe SMTP chiffré avec succès');
    
  } else if (!isPasswordModified && hasExistingPassword) {
    console.log('ℹ️ Mot de passe existant conservé (non modifié)');
    // Ne rien ajouter à passwordUpdate → mot de passe non touché
  }
  
  // Upsert sans écraser le mot de passe si passwordUpdate est vide
  await supabase.from('user_settings').upsert({
    user_id: userId,
    // ... autres champs
    ...passwordUpdate,  // ✅ Vide si pas modifié
  }, { onConflict: 'user_id' });
  
  // Recharger les settings pour afficher le nouveau placeholder
  await loadSettings();
};
```

**Résultat** :
- ✅ **Sauvegarde UNIQUEMENT si modifié**
- ✅ **Conservation du mot de passe existant** si non touché
- ✅ **Rechargement automatique** après sauvegarde

---

### **4️⃣ Message visuel**

**Fichier** : `src/components/Settings.tsx`

```tsx
{hasExistingPassword && !isPasswordModified && (
  <p className="text-xs text-green-600 mb-2">
    ✓ Mot de passe enregistré. Laissez vide pour le conserver.
  </p>
)}
```

**Résultat** :
```
┌─────────────────────────────────────────┐
│ Mot de passe *                          │
│ ✓ Mot de passe enregistré.             │
│   Laissez vide pour le conserver.      │
│                                         │
│ [••••••••••••]         [👁️]             │
└─────────────────────────────────────────┘
```

---

## 📊 **Flux Complet**

### **Scénario 1 : Premier enregistrement**

```
1. User ouvre Settings
   └── hasExistingPassword = false
   └── smtpPassword = ''
   └── Placeholder : "Nouveau mot de passe"

2. User saisit "monmotdepasse123"
   └── isPasswordModified = true
   └── smtpPassword = "monmotdepasse123"

3. User clique "Enregistrer"
   └── 🔐 Chiffrement...
   └── smtp_password_encrypted = [ENCRYPTED]
   └── smtp_password = NULL

4. Rechargement
   └── hasExistingPassword = true
   └── smtpPassword = "••••••••••••"
   └── Message : "✓ Mot de passe enregistré"
```

---

### **Scénario 2 : Modification d'un autre champ (sans toucher au mot de passe)**

```
1. User ouvre Settings
   └── hasExistingPassword = true
   └── smtpPassword = "••••••••••••"
   └── isPasswordModified = false
   └── Message : "✓ Mot de passe enregistré"

2. User modifie SMTP Host : "smtp.gmail.com"
   └── smtpPassword reste "••••••••••••"
   └── isPasswordModified reste false

3. User clique "Enregistrer"
   └── ℹ️ Mot de passe existant conservé (non modifié)
   └── smtp_host = "smtp.gmail.com"
   └── smtp_password_encrypted = [INCHANGÉ]

4. Rechargement
   └── smtpPassword = "••••••••••••"
   └── Message : "✓ Mot de passe enregistré"
```

---

### **Scénario 3 : Modification du mot de passe**

```
1. User ouvre Settings
   └── hasExistingPassword = true
   └── smtpPassword = "••••••••••••"
   └── isPasswordModified = false

2. User clique dans le champ (onFocus)
   └── smtpPassword = '' (vidé)
   └── Placeholder : "Nouveau mot de passe"

3. User saisit "nouveaumotdepasse456"
   └── isPasswordModified = true
   └── smtpPassword = "nouveaumotdepasse456"

4. User clique "Enregistrer"
   └── 🔐 Chiffrement du nouveau mot de passe...
   └── smtp_password_encrypted = [NEW_ENCRYPTED]
   └── smtp_password = NULL

5. Rechargement
   └── smtpPassword = "••••••••••••"
   └── Message : "✓ Mot de passe enregistré"
```

---

## 🧪 **Tests**

### **Test 1 : Premier enregistrement**
1. ✅ User n'a jamais enregistré de mot de passe SMTP
2. ✅ Ouvrir Settings → Section SMTP
3. ✅ **RÉSULTAT** : Champ vide, placeholder "Nouveau mot de passe", pas de message vert
4. ✅ Saisir un mot de passe → Enregistrer
5. ✅ **RÉSULTAT** : Rechargement, champ "••••••••••••", message "✓ Mot de passe enregistré"

### **Test 2 : Modification sans toucher au mot de passe**
1. ✅ User a déjà un mot de passe SMTP enregistré
2. ✅ Ouvrir Settings → Modifier SMTP Host
3. ✅ **NE PAS TOUCHER** au champ mot de passe
4. ✅ Enregistrer
5. ✅ **RÉSULTAT** : Console log "ℹ️ Mot de passe existant conservé", rechargement OK

### **Test 3 : Modification du mot de passe**
1. ✅ User a déjà un mot de passe SMTP enregistré
2. ✅ Ouvrir Settings → Cliquer dans le champ mot de passe
3. ✅ **RÉSULTAT** : Champ se vide automatiquement
4. ✅ Saisir nouveau mot de passe → Enregistrer
5. ✅ **RÉSULTAT** : Console log "🔐 Chiffrement...", rechargement OK

### **Test 4 : Vérification dans la DB**
```sql
SELECT 
  user_id, 
  smtp_user, 
  smtp_password_encrypted IS NOT NULL as has_password,
  smtp_password -- Devrait être NULL
FROM user_settings
WHERE user_id = 'USER_ID';
```

**Résultat attendu** :
```
user_id              | smtp_user          | has_password | smtp_password
---------------------|--------------------|--------------|--------------
uuid-xxx-xxx         | user@example.com   | true         | NULL
```

### **Test 5 : Autofill désactivé**
1. ✅ Ouvrir Settings avec navigateur autofill activé
2. ✅ **RÉSULTAT** : Champ **PAS BLEU**, affiche "••••••••••••"
3. ✅ Navigateur ne propose pas de remplir automatiquement

---

## 🔒 **Sécurité**

### **Chiffrement**
- ✅ Mot de passe **jamais en clair** dans la DB
- ✅ Chiffré via `encrypt_smtp_password(password, user_id)`
- ✅ Déchiffré uniquement lors de l'envoi d'email (Edge Function)

### **Placeholder**
- ✅ `••••••••••••` : Indicateur visuel uniquement
- ❌ **Ne représente PAS le mot de passe réel**
- ✅ Vidé au focus pour éviter confusion

### **Autofill**
- ✅ `autoComplete="new-password"` : Désactive l'autofill
- ✅ `data-form-type="other"` : Hint supplémentaire

---

## 📁 **Fichiers Modifiés**

| Fichier | Changement | Lignes |
|---------|-----------|--------|
| `src/components/Settings.tsx` | États + Chargement + Input + Sauvegarde | +40 |
| `FIX_SMTP_PASSWORD_PERSISTENCE.md` | Documentation | +400 |

---

## 🎨 **Interface Avant/Après**

### **Avant** ❌
```
┌─────────────────────────────────────────┐
│ Mot de passe *                          │
│                                         │
│ [            ]         [👁️]             │ (vide, bleu autofill)
└─────────────────────────────────────────┘

User : "Est-ce qu'il y a un mot de passe enregistré ? 🤔"
```

### **Après** ✅
```
┌─────────────────────────────────────────┐
│ Mot de passe *                          │
│ ✓ Mot de passe enregistré.             │
│   Laissez vide pour le conserver.      │
│                                         │
│ [••••••••••••]         [👁️]             │ (placeholder, pas bleu)
└─────────────────────────────────────────┘

User : "OK, j'ai bien un mot de passe ! ✅"
```

---

## 🚀 **Déploiement**

```bash
# Build
npm run build

# Redéployer
netlify deploy --prod
# ou
vercel --prod
```

**Base de données** : Aucune modification nécessaire ✅

---

## ✅ **Résumé**

### **Problèmes résolus**
- ✅ Mot de passe **conservé** après sauvegarde
- ✅ **Indication visuelle** claire (placeholder + message vert)
- ✅ **Autofill désactivé** (pas de champ bleu)
- ✅ **Sauvegarde intelligente** (uniquement si modifié)
- ✅ **Rechargement automatique** après sauvegarde

### **Expérience utilisateur**
- ✅ User **voit** qu'un mot de passe existe
- ✅ User peut **modifier** sans re-saisir tous les champs
- ✅ User n'est **pas confus** par l'autofill

---

**🎉 Mot de passe SMTP maintenant persistant et visible !**

