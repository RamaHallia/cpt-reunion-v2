# 🔧 FIX : Utilisation de Nodemailer pour Test SMTP

## 🐛 **L'Erreur**

```
❌ Échec de connexion : client.connect is not a function
TypeError: client.connect is not a function
    at Object.handler (index.ts:116:20)
```

---

## 🔍 **Cause**

**Problème** : `denomailer` (SMTPClient) ne fonctionne pas comme prévu dans Deno Edge Functions.

**Raison** : L'API de `denomailer` est différente et incompatible avec notre usage.

---

## ✅ **Solution : Utiliser Nodemailer**

Nous utilisons déjà `nodemailer` dans `send-email-smtp`, c'est une librairie **plus mature** et **mieux supportée**.

---

## 🔧 **Modifications Appliquées**

### **1️⃣ Import de Nodemailer**

**Avant** ❌ :
```typescript
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
```

**Après** ✅ :
```typescript
import nodemailer from 'npm:nodemailer@6.9.7';
```

---

### **2️⃣ Test de connexion**

**Avant (denomailer)** ❌ :
```typescript
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

await client.connect();  // ❌ Ne fonctionne pas
await client.close();
```

**Après (nodemailer)** ✅ :
```typescript
const transporter = nodemailer.createTransport({
  host: host,
  port: port,
  secure: secure, // true pour 465, false pour 587
  auth: {
    user: smtpUser,
    pass: finalPassword,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
});

await transporter.verify();  // ✅ Vérifie la connexion
```

---

### **3️⃣ Messages d'erreur améliorés**

Nodemailer fournit des codes d'erreur clairs :

| Code d'erreur | Message utilisateur |
|---------------|---------------------|
| `EAUTH` ou `535` | Authentification échouée. Pour Gmail, utilisez un mot de passe d'application. |
| `ECONNREFUSED` | Impossible de contacter le serveur. Vérifiez l'adresse et le port. |
| `ETIMEDOUT` ou `ESOCKET` | Délai d'attente dépassé. Vérifiez votre connexion internet. |
| `ETLS` | Erreur de sécurité. Vérifiez le port (587 pour TLS, 465 pour SSL). |

---

## 📊 **Comparaison**

| Aspect | denomailer | nodemailer |
|--------|-----------|------------|
| **Maturité** | ⚠️ Récent, moins stable | ✅ Mature, éprouvé |
| **API** | ❌ Incompatible | ✅ Standard |
| **Support Deno** | ⚠️ Limité | ✅ Via npm: |
| **Déjà utilisé** | ❌ Non | ✅ Oui (send-email-smtp) |
| **Méthode de test** | `connect()` + `close()` | ✅ `verify()` |

---

## 🔧 **Code Final**

**Fichier** : `supabase/functions/test-smtp-connection/index.ts`

```typescript
import nodemailer from 'npm:nodemailer@6.9.7';

// ...

// Tester la connexion SMTP avec Nodemailer
const transporter = nodemailer.createTransport({
  host: host,
  port: port,
  secure: secure, // true pour 465, false pour 587
  auth: {
    user: smtpUser,
    pass: finalPassword,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
});

try {
  // Vérifier la connexion
  await transporter.verify();
  console.log('✅ Connexion SMTP réussie et vérifiée');

  return new Response(
    JSON.stringify({ success: true, message: 'Connexion SMTP réussie' }),
    { status: 200, headers: corsHeaders }
  );
} catch (smtpError: any) {
  // Messages d'erreur clairs
  let errorMessage = 'Connexion échouée';
  
  if (smtpError.code === 'EAUTH' || smtpError.responseCode === 535) {
    errorMessage = 'Authentification échouée. Pour Gmail, utilisez un mot de passe d\'application.';
  } else if (smtpError.code === 'ECONNREFUSED') {
    errorMessage = 'Impossible de contacter le serveur. Vérifiez l\'adresse et le port.';
  } else if (smtpError.code === 'ESOCKET' || smtpError.message?.includes('timeout')) {
    errorMessage = 'Délai d\'attente dépassé. Vérifiez votre connexion internet.';
  } else if (smtpError.code === 'ETLS') {
    errorMessage = 'Erreur de sécurité. Vérifiez le port (587 pour TLS, 465 pour SSL).';
  }

  return new Response(
    JSON.stringify({ success: false, error: errorMessage }),
    { status: 200, headers: corsHeaders }
  );
}
```

---

## 🚀 **Déploiement**

### **Via Supabase Dashboard**

1. ✅ https://supabase.com/dashboard → Votre projet
2. ✅ **Edge Functions** → `test-smtp-connection`
3. ✅ **Edit** → Copiez tout le code de `supabase/functions/test-smtp-connection/index.ts`
4. ✅ **Deploy**
5. ✅ Attendez ~30 secondes

---

## 🧪 **Test**

### **Test 1 : Gmail avec mot de passe d'application**

**Configuration** :
- Serveur : `smtp.gmail.com`
- Port : `587`
- Email : `votre@gmail.com`
- Mot de passe : **Mot de passe d'application** (pas votre mot de passe normal)

**Résultat attendu** :
```
✅ Connexion réussie ! Les identifiants sont corrects.
```

---

### **Test 2 : Gmail avec mauvais mot de passe**

**Configuration** :
- Mot de passe : `mauvais_mot_de_passe`

**Résultat attendu** :
```
❌ Échec de connexion : Authentification échouée. 
   Pour Gmail, utilisez un mot de passe d'application.
```

---

### **Test 3 : Mauvais serveur**

**Configuration** :
- Serveur : `smtp.invalide.com`

**Résultat attendu** :
```
❌ Échec de connexion : Impossible de contacter le serveur. 
   Vérifiez l'adresse et le port.
```

---

### **Test 4 : Mauvais port**

**Configuration** :
- Port : `999`

**Résultat attendu** :
```
❌ Échec de connexion : Impossible de contacter le serveur. 
   Vérifiez l'adresse et le port.
```

---

## 📊 **Logs Attendus**

Dans **Dashboard** → **Edge Functions** → `test-smtp-connection` → **Logs** :

### **Succès** ✅
```
📋 Auth header présent: true
👤 User récupéré: uuid-abc-123 Error: undefined
🔌 Test de connexion SMTP: { host: 'smtp.gmail.com', port: 587, ... }
📧 Tentative de connexion au serveur SMTP...
✅ Connexion SMTP réussie et vérifiée
```

### **Échec authentification** ❌
```
📧 Tentative de connexion au serveur SMTP...
❌ Erreur SMTP: Error: Invalid login: 535-5.7.8 Username and Password not accepted
```

---

## 💡 **Avantages de Nodemailer**

1. ✅ **`.verify()`** : Méthode dédiée pour tester la connexion
2. ✅ **Codes d'erreur clairs** : `EAUTH`, `ECONNREFUSED`, `ETLS`, etc.
3. ✅ **Timeouts configurables** : `connectionTimeout`, `greetingTimeout`
4. ✅ **Déjà utilisé** : Même librairie que `send-email-smtp`
5. ✅ **Bien documenté** : https://nodemailer.com/

---

## 📁 **Fichiers Modifiés**

- ✅ `supabase/functions/test-smtp-connection/index.ts` (Import + Transporter)
- ✅ `FIX_SMTP_TEST_NODEMAILER.md` (Ce document)

---

## ✅ **Checklist**

Avant de tester :

- [ ] Edge Function redéployée avec Nodemailer
- [ ] Frontend buildé et redéployé
- [ ] Gmail : Mot de passe d'application créé
- [ ] Champs SMTP remplis

---

## 🎯 **Test Final Complet**

### **Étape 1 : Créer un mot de passe d'application Gmail**

1. ✅ Allez sur https://myaccount.google.com/security
2. ✅ **Validation en 2 étapes** → **Mots de passe d'application**
3. ✅ Sélectionnez **"Autre"** → Nom : `Meeting App`
4. ✅ **Générer** → Copiez le mot de passe (16 caractères)

### **Étape 2 : Tester dans Settings**

1. ✅ Ouvrir **Settings** → **SMTP**
2. ✅ Remplir :
   - Serveur : `smtp.gmail.com`
   - Port : `587`
   - Email : `votre@gmail.com`
   - Mot de passe : **[Coller le mot de passe d'application]**
3. ✅ Cliquer **"Tester la connexion SMTP"**
4. ✅ **RÉSULTAT** : "✅ Connexion réussie !"

---

**🎉 Nodemailer intégré ! Redéployez et testez ! 🚀**

**Note importante** : Pour Gmail, n'utilisez **jamais** votre mot de passe normal, toujours un **mot de passe d'application**.

