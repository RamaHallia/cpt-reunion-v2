# 🚀 Déploiement : Test de Connexion SMTP

## 📋 Résumé des modifications

1. ✅ **Settings.tsx** : Bouton "Tester la connexion SMTP" + États + Affichage résultat
2. ✅ **test-smtp-connection/index.ts** : Edge Function pour tester la connexion
3. ✅ **Correction "Unauthorized"** : Utilisation de `SERVICE_ROLE_KEY` pour RPC

---

## 🚀 Étapes de Déploiement

### **1. Déployer l'Edge Function**

**Via Supabase CLI** (recommandé) :
```bash
# Se positionner dans le dossier du projet
cd "C:\Users\tech\OneDrive\Desktop\Nouveau dossier\project"

# Déployer la fonction
npx supabase functions deploy test-smtp-connection
```

**Via Supabase Dashboard** (alternative) :
1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. **Edge Functions** → **New function**
4. Nom : `test-smtp-connection`
5. Copiez le contenu de `supabase/functions/test-smtp-connection/index.ts`
6. **Deploy**

---

### **2. Vérifier les variables d'environnement**

La fonction a besoin de ces variables :
```bash
SUPABASE_URL              # ✅ Automatique
SUPABASE_ANON_KEY        # ✅ Automatique
SUPABASE_SERVICE_ROLE_KEY # ✅ Automatique
```

**Vérification** :
1. Dashboard → **Settings** → **API**
2. Vérifiez que `service_role key (secret)` est présente

---

### **3. Tester la fonction**

**Via Dashboard** :
1. **Edge Functions** → `test-smtp-connection`
2. **Invoke function**
3. Body :
```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "user": "votre@email.com",
  "password": "votremotdepasse",
  "secure": false,
  "userId": "votre-user-id",
  "useExistingPassword": false
}
```
4. **Send request**
5. **Résultat attendu** : `{ "success": true, "message": "Connexion SMTP réussie" }`

---

### **4. Build et redéployer le frontend**

```bash
npm run build
```

Puis redéployez sur votre hébergement (Netlify, Vercel, etc.)

---

## 🐛 Debug de l'erreur "Unauthorized"

### **Causes possibles**

1. ❌ **Token JWT expiré**
   - User doit se reconnecter
   
2. ❌ **SERVICE_ROLE_KEY manquante**
   - Vérifier dans Dashboard → Settings → API
   
3. ❌ **RLS Policy restrictive**
   - `decrypt_smtp_password` doit être `SECURITY DEFINER`

---

### **Vérifications**

#### **A. Vérifier le token dans le frontend**

Ajoutez ceci temporairement dans `Settings.tsx` :
```typescript
const handleTestSmtpConnection = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  console.log('🔑 Session:', session?.user?.id);
  console.log('🔑 Token:', session?.access_token?.substring(0, 20) + '...');
  
  // ... reste du code
};
```

#### **B. Vérifier les logs de l'Edge Function**

1. Dashboard → **Edge Functions** → `test-smtp-connection`
2. **Logs** (en temps réel)
3. Chercher :
   ```
   📋 Auth header présent: true
   👤 User récupéré: uuid-xxx Error: undefined
   ```

#### **C. Tester avec curl**

```bash
# Récupérer le token
# (depuis la console du navigateur après login)
TOKEN="votre-token-jwt"

# Tester la fonction
curl -X POST "https://VOTRE_PROJECT.supabase.co/functions/v1/test-smtp-connection" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "smtp.gmail.com",
    "port": 587,
    "user": "test@gmail.com",
    "password": "testpass",
    "secure": false,
    "userId": "votre-user-id",
    "useExistingPassword": false
  }'
```

---

## 🔧 Solutions aux Erreurs Courantes

### **Erreur 1 : "Unauthorized" (ligne 32)**

**Cause** : Token JWT invalide ou expiré

**Solution** :
```typescript
// Dans Settings.tsx, forcer refresh du token
const { data: { session }, error } = await supabase.auth.refreshSession();
if (error) {
  alert('Session expirée. Veuillez vous reconnecter.');
  return;
}
```

---

### **Erreur 2 : "Missing authorization header"**

**Cause** : Header `Authorization` non envoyé

**Solution** : Vérifier dans `Settings.tsx` :
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/test-smtp-connection`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`, // ✅ IMPORTANT
  },
  body: JSON.stringify({ ... })
});
```

---

### **Erreur 3 : "Impossible de déchiffrer le mot de passe"**

**Cause** : `decrypt_smtp_password` RPC non accessible

**Solution** : Vérifier dans SQL Editor :
```sql
-- Vérifier que la fonction existe
SELECT proname, proargtypes 
FROM pg_proc 
WHERE proname = 'decrypt_smtp_password';

-- Vérifier les permissions
SELECT routine_name, security_type 
FROM information_schema.routines 
WHERE routine_name = 'decrypt_smtp_password';
-- Devrait être : DEFINER (pas INVOKER)
```

---

### **Erreur 4 : "535 authentication failed"**

**Cause** : Identifiants SMTP incorrects (c'est normal, c'est le but du test !)

**Solution** : User doit corriger ses identifiants SMTP

---

## 📊 Logs de Debug

### **Frontend (Console navigateur)**

```
🔌 Test de connexion SMTP...
🔑 Session: uuid-abc-123
🔑 Token: eyJhbGciOiJIUzI1Ni...
```

### **Backend (Edge Function Logs)**

```
📋 Auth header présent: true
👤 User récupéré: uuid-abc-123 Error: undefined
🔌 Test de connexion SMTP: { host: 'smtp.gmail.com', port: 587, ... }
🔐 Récupération du mot de passe existant...
✅ Mot de passe déchiffré
📧 Tentative de connexion au serveur SMTP...
✅ Connexion SMTP réussie
✅ Déconnexion SMTP
```

---

## ✅ Checklist de Vérification

Avant de tester :

- [ ] Edge Function déployée (`test-smtp-connection`)
- [ ] Variables d'environnement présentes (SERVICE_ROLE_KEY)
- [ ] Frontend buildé et redéployé
- [ ] User connecté (session valide)
- [ ] Champs SMTP remplis (host, port, user)
- [ ] Mot de passe saisi OU existant en DB

---

## 🎯 Test Final

### **Étape 1 : Test avec nouveau mot de passe**

1. Ouvrir **Settings** → **Méthode d'envoi** → **SMTP**
2. Remplir :
   - Serveur : `smtp.gmail.com`
   - Port : `587`
   - Email : `votre@gmail.com`
   - Mot de passe : **Votre mot de passe d'application Gmail**
3. Cliquer **"Tester la connexion SMTP"**
4. **Résultat attendu** : "✅ Connexion réussie !"

### **Étape 2 : Test avec mot de passe existant**

1. Enregistrer les paramètres (si pas déjà fait)
2. Recharger la page
3. Champ MDP affiche : `••••••••••••`
4. Cliquer **"Tester la connexion SMTP"**
5. Modal : "Voulez-vous tester avec le mot de passe enregistré ?" → **OK**
6. **Résultat attendu** : "✅ Connexion réussie !"

### **Étape 3 : Test avec mauvais mot de passe**

1. Saisir un mauvais mot de passe
2. Cliquer **"Tester la connexion SMTP"**
3. **Résultat attendu** : "❌ Échec de connexion : Authentification échouée..."

---

## 📞 Support

Si l'erreur persiste :

1. **Copier les logs** :
   - Console navigateur (F12)
   - Edge Function logs (Dashboard)
   
2. **Vérifier** :
   - Session valide : `supabase.auth.getSession()`
   - Token non expiré : `session.expires_at`
   
3. **Forcer reconnexion** :
   ```typescript
   await supabase.auth.signOut();
   // Puis se reconnecter
   ```

---

**🎉 Fonction de test SMTP déployée ! Testez maintenant ! 🚀**

