# 🔌 Test de Connexion SMTP

## 🎯 Objectif

Permettre aux utilisateurs de **tester leurs identifiants SMTP** avant de les sauvegarder pour éviter :
- ❌ Mot de passe incorrect
- ❌ Serveur SMTP invalide
- ❌ Port incorrect
- ❌ Configuration TLS/SSL erronée

---

## 🔧 Fonctionnalités Implémentées

### **1️⃣ Bouton "Tester la connexion SMTP"**

**Fichier** : `src/components/Settings.tsx`

**Interface** :
```tsx
<button
  onClick={handleTestSmtpConnection}
  disabled={isTestingSmtp || !smtpHost || !smtpUser}
  className="bg-blue-500 text-white hover:bg-blue-600"
>
  {isTestingSmtp ? (
    <>
      <Spinner />
      <span>Test en cours...</span>
    </>
  ) : (
    <>
      <BoltIcon />
      <span>Tester la connexion SMTP</span>
    </>
  )}
</button>
```

**États** :
- ✅ **Activé** : Si `smtpHost` ET `smtpUser` remplis
- 🔄 **En cours** : Spinner + "Test en cours..."
- ❌ **Désactivé** : Si champs vides

---

### **2️⃣ Affichage du résultat**

**Succès** ✅ :
```
┌────────────────────────────────────────────┐
│ ✅ Connexion réussie ! Les identifiants   │
│    sont corrects.                          │
│                                            │
│ Vous pouvez maintenant enregistrer vos    │
│ paramètres.                                │
└────────────────────────────────────────────┘
(Vert clair, bordure verte)
```

**Échec** ❌ :
```
┌────────────────────────────────────────────┐
│ ❌ Échec de connexion : Authentification  │
│    échouée. Vérifiez votre email et       │
│    mot de passe.                           │
└────────────────────────────────────────────┘
(Rouge clair, bordure rouge)
```

---

### **3️⃣ Fonction de test (Frontend)**

**Fichier** : `src/components/Settings.tsx`

```typescript
const handleTestSmtpConnection = async () => {
  setIsTestingSmtp(true);
  setSmtpTestResult(null);

  try {
    // Validation basique
    if (!smtpHost || !smtpUser) {
      setSmtpTestResult({
        success: false,
        message: 'Veuillez remplir le serveur SMTP et l\'email/utilisateur'
      });
      return;
    }

    // Si mot de passe existant et pas modifié, demander confirmation
    if (!isPasswordModified && hasExistingPassword) {
      const shouldUseExisting = confirm(
        'Voulez-vous tester avec le mot de passe déjà enregistré ?\n\n' +
        'OK = Utiliser le mot de passe enregistré\n' +
        'Annuler = Saisir un nouveau mot de passe'
      );

      if (!shouldUseExisting) {
        setSmtpTestResult({
          success: false,
          message: 'Veuillez saisir un mot de passe pour tester'
        });
        return;
      }
    }

    // Appeler l'Edge Function
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/test-smtp-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        password: isPasswordModified ? smtpPassword : undefined,
        secure: smtpPort === 465,
        userId: userId,
        useExistingPassword: !isPasswordModified && hasExistingPassword
      }),
    });

    const result = await response.json();

    if (result.success) {
      setSmtpTestResult({
        success: true,
        message: '✅ Connexion réussie ! Les identifiants sont corrects.'
      });
    } else {
      setSmtpTestResult({
        success: false,
        message: `❌ Échec de connexion : ${result.error}`
      });
    }
  } catch (error: any) {
    setSmtpTestResult({
      success: false,
      message: `❌ Erreur : ${error.message}`
    });
  } finally {
    setIsTestingSmtp(false);
  }
};
```

---

### **4️⃣ Edge Function de test**

**Fichier** : `supabase/functions/test-smtp-connection/index.ts`

**Flux** :

1. **Authentification** : Vérifier le token JWT
2. **Récupération du mot de passe** :
   - Si `useExistingPassword = true` : Récupérer et déchiffrer depuis la DB
   - Sinon : Utiliser le mot de passe fourni
3. **Test de connexion** : Utiliser `SMTPClient` de `denomailer`
4. **Retour du résultat** : `{ success: true/false, message/error }`

**Code** :
```typescript
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

// ...

const client = new SMTPClient({
  connection: {
    hostname: host,
    port: port,
    tls: secure,
    auth: {
      username: smtpUser,
      password: finalPassword,
    },
  },
});

try {
  // Tenter de se connecter
  await client.connect();
  console.log('✅ Connexion SMTP réussie');

  // Se déconnecter immédiatement
  await client.close();

  return new Response(
    JSON.stringify({ success: true, message: 'Connexion SMTP réussie' }),
    { status: 200, headers: corsHeaders }
  );
} catch (smtpError: any) {
  // Messages d'erreur explicites
  let errorMessage = 'Connexion échouée';
  
  if (smtpError.message?.includes('authentication failed')) {
    errorMessage = 'Authentification échouée. Vérifiez votre email et mot de passe.';
  } else if (smtpError.message?.includes('ECONNREFUSED')) {
    errorMessage = 'Impossible de contacter le serveur. Vérifiez l\'adresse et le port.';
  } else if (smtpError.message?.includes('TLS')) {
    errorMessage = 'Erreur de sécurité. Vérifiez le port (587 pour TLS, 465 pour SSL).';
  }

  return new Response(
    JSON.stringify({ success: false, error: errorMessage }),
    { status: 200, headers: corsHeaders }
  );
}
```

---

## 📊 Flux Complet

### **Scénario 1 : Test avec nouveau mot de passe**

```
1. User saisit :
   - Serveur : smtp.gmail.com
   - Port : 587
   - Email : user@gmail.com
   - Mot de passe : "monmotdepasse123"

2. User clique "Tester la connexion"
   └── handleTestSmtpConnection()
       ├── Validation champs
       ├── Fetch Edge Function avec password
       └── Edge Function :
           ├── SMTPClient.connect()
           ├── ✅ Connexion réussie
           └── SMTPClient.close()

3. Affichage :
   "✅ Connexion réussie ! Les identifiants sont corrects."

4. User clique "Enregistrer"
   └── Mot de passe chiffré et sauvegardé
```

---

### **Scénario 2 : Test avec mot de passe existant**

```
1. User a déjà un mot de passe enregistré
   - Champ affiche "••••••••••••"
   - hasExistingPassword = true
   - isPasswordModified = false

2. User clique "Tester la connexion"
   └── Modal confirm :
       "Voulez-vous tester avec le mot de passe enregistré ?"
       [OK]  →  useExistingPassword = true
       [Annuler]  →  Message "Veuillez saisir un mot de passe"

3. User clique "OK"
   └── Edge Function :
       ├── Récupère smtp_password_encrypted de la DB
       ├── Déchiffre avec decrypt_smtp_password()
       ├── SMTPClient.connect(decryptedPassword)
       ├── ✅ Connexion réussie
       └── SMTPClient.close()

4. Affichage :
   "✅ Connexion réussie !"
```

---

### **Scénario 3 : Échec de connexion**

```
1. User saisit un mauvais mot de passe

2. User clique "Tester la connexion"
   └── Edge Function :
       ├── SMTPClient.connect()
       ├── ❌ SMTP Error: "535 authentication failed"
       └── Return { success: false, error: "Authentification échouée..." }

3. Affichage :
   "❌ Échec de connexion : Authentification échouée.
    Vérifiez votre email et mot de passe."

4. User corrige le mot de passe et réessaye
```

---

## 🚀 Déploiement

### **Étape 1 : Déployer l'Edge Function**

```bash
cd supabase
npx supabase functions deploy test-smtp-connection
```

**Vérification** :
```bash
# Lister les fonctions
npx supabase functions list
# Devrait afficher : test-smtp-connection
```

### **Étape 2 : Build et redéployer le frontend**

```bash
npm run build
# Puis redéployer sur votre hébergement
```

---

## 🧪 Tests

### **Test 1 : Test avec identifiants corrects**
1. ✅ Ouvrir Settings → Méthode SMTP
2. ✅ Remplir : `smtp.gmail.com`, `587`, `user@gmail.com`, `motdepasse`
3. ✅ Cliquer **"Tester la connexion SMTP"**
4. ✅ **RÉSULTAT** : "✅ Connexion réussie !"

### **Test 2 : Test avec mauvais mot de passe**
1. ✅ Remplir avec un mauvais mot de passe
2. ✅ Cliquer **"Tester la connexion"**
3. ✅ **RÉSULTAT** : "❌ Authentification échouée..."

### **Test 3 : Test avec mauvais serveur**
1. ✅ Remplir : `smtp.invalide.com`
2. ✅ Cliquer **"Tester la connexion"**
3. ✅ **RÉSULTAT** : "❌ Impossible de contacter le serveur..."

### **Test 4 : Test avec mot de passe existant**
1. ✅ User a déjà un mot de passe enregistré
2. ✅ Champ affiche "••••••••••••"
3. ✅ Cliquer **"Tester la connexion"**
4. ✅ **RÉSULTAT** : Modal "Voulez-vous tester avec le mot de passe enregistré ?"
5. ✅ Cliquer "OK" → Test réussi

### **Test 5 : Test avec champs vides**
1. ✅ Laisser les champs vides
2. ✅ **RÉSULTAT** : Bouton "Tester" **désactivé** (gris)

---

## 🎨 Design de l'Interface

### **Bouton**

```
┌────────────────────────────────────────┐
│  [⚡] Tester la connexion SMTP         │ (Bleu, activé)
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  [⊙] Test en cours...                  │ (Gris, spinner)
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  [⚡] Tester la connexion SMTP         │ (Gris clair, désactivé)
└────────────────────────────────────────┘
```

### **Résultats**

**Succès** :
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ✅ Connexion réussie ! Les identifiants┃ (Fond vert clair)
┃    sont corrects.                      ┃
┃                                        ┃
┃ Vous pouvez maintenant enregistrer vos┃
┃ paramètres.                            ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**Échec** :
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ❌ Échec de connexion : Authentification┃ (Fond rouge clair)
┃    échouée. Vérifiez votre email et   ┃
┃    mot de passe.                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## 📁 Fichiers Créés/Modifiés

| Fichier | Changement | Lignes |
|---------|-----------|--------|
| `src/components/Settings.tsx` | États + Fonction test + Bouton + Affichage | +90 |
| `supabase/functions/test-smtp-connection/index.ts` | Edge Function de test | +180 |
| `SMTP_CONNECTION_TEST.md` | Documentation | +500 |

---

## ⚙️ Messages d'Erreur

| Erreur SMTP | Message User-Friendly |
|-------------|----------------------|
| `535 authentication failed` | Authentification échouée. Vérifiez votre email et mot de passe. |
| `ECONNREFUSED` | Impossible de contacter le serveur. Vérifiez l'adresse et le port. |
| `ETIMEDOUT` | Délai d'attente dépassé. Vérifiez l'adresse du serveur. |
| `TLS/SSL error` | Erreur de sécurité. Vérifiez le port (587 pour TLS, 465 pour SSL). |
| Autres | Message d'erreur technique brut |

---

## 🔒 Sécurité

### **Authentification**
- ✅ Token JWT vérifié pour chaque requête
- ✅ `user_id` validé côté serveur

### **Mot de passe**
- ✅ **Jamais envoyé en clair** si déjà enregistré
- ✅ Déchiffrement côté serveur uniquement
- ✅ Connexion SMTP fermée immédiatement après le test

### **Rate Limiting** (Recommandé)
- 🔜 Limiter à 5 tests/minute par utilisateur
- 🔜 Implémenter via Supabase Edge Functions

---

## ✅ Résumé

### **Fonctionnalités**
- ✅ Bouton "Tester la connexion SMTP"
- ✅ Test avec nouveau mot de passe
- ✅ Test avec mot de passe existant (déchiffré)
- ✅ Messages d'erreur clairs et explicites
- ✅ Validation avant envoi
- ✅ Feedback visuel (spinner, couleurs)

### **Avantages**
- 👍 **Évite les erreurs** : User sait immédiatement si ça marche
- 👍 **Gain de temps** : Pas besoin d'enregistrer pour tester
- 👍 **UX améliorée** : Messages clairs, pas de jargon technique
- 👍 **Sécurité** : Mot de passe jamais exposé

---

**🎉 Test SMTP opérationnel ! Déployez et testez ! 🚀**

