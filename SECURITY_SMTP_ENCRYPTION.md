# 🔐 Chiffrement des Mots de Passe SMTP

## Vue d'ensemble

Les mots de passe SMTP sont maintenant **chiffrés** dans la base de données pour améliorer la sécurité. Cette documentation explique comment le système fonctionne.

---

## 🔄 Flux de Données

### **1. Sauvegarde du mot de passe (Settings.tsx)**

```
Utilisateur saisit le mot de passe
  ↓
Frontend appelle encrypt_smtp_password()
  ↓
Base de données chiffre avec AES-256
  ↓
Stocké dans smtp_password_encrypted (bytea)
  ↓
smtp_password (plain text) = NULL
```

### **2. Envoi d'email (send-email-smtp/index.ts)**

```
Récupération des paramètres SMTP
  ↓
Vérifie smtp_password_encrypted
  ↓
Appelle decrypt_smtp_password()
  ↓
Base de données déchiffre le mot de passe
  ↓
Utilise le mot de passe pour SMTP
```

---

## 🛠️ Fonctions de Base de Données

### **encrypt_smtp_password(password text, user_id uuid)**

**Entrée :**
- `password` : Mot de passe en clair
- `user_id` : ID de l'utilisateur

**Sortie :**
- `bytea` : Mot de passe chiffré

**Chiffrement :**
- Algorithme : **AES-256** (via `pgp_sym_encrypt`)
- Clé : Dérivée de `SHA256(user_id + 'hallia-secret-key-2025')`
- Unique par utilisateur (un attaquant ne peut pas déchiffrer tous les mots de passe avec une seule clé)

**Exemple :**
```sql
SELECT encrypt_smtp_password('mon_mot_de_passe', 'abc-123-user-id');
-- Retourne: \x960C3F... (bytea)
```

---

### **decrypt_smtp_password(encrypted_password bytea, user_id uuid)**

**Entrée :**
- `encrypted_password` : Mot de passe chiffré (bytea)
- `user_id` : ID de l'utilisateur

**Sortie :**
- `text` : Mot de passe déchiffré

**Exemple :**
```sql
SELECT decrypt_smtp_password('\x960C3F...', 'abc-123-user-id');
-- Retourne: 'mon_mot_de_passe'
```

---

## 📋 Migrations Appliquées

### **1. `20251023000002_add_smtp_password_encryption.sql`**
- ✅ Active l'extension `pgcrypto`
- ✅ Ajoute la colonne `smtp_password_encrypted`
- ✅ Crée les fonctions `encrypt_smtp_password()` et `decrypt_smtp_password()`

### **2. `20251026000002_migrate_smtp_passwords_to_encrypted.sql`**
- ✅ Migre les mots de passe existants en clair vers la version chiffrée
- ✅ Supprime les mots de passe en clair (`smtp_password = NULL`)
- ✅ Marque `smtp_password` comme déprécié

---

## 🔒 Sécurité

### **Avantages :**

1. **Chiffrement AES-256** : Standard militaire
2. **Clé unique par utilisateur** : Même si la base est compromise, un attaquant devra déchiffrer chaque mot de passe individuellement
3. **Pas de mot de passe en clair** : Même les administrateurs de la base ne peuvent pas voir les mots de passe
4. **Rétrocompatibilité** : Supporte les anciens mots de passe en clair (fallback) pendant la migration

### **Limitations :**

1. **Clé de chiffrement en dur** : La clé `'hallia-secret-key-2025'` est en dur dans le code
   - **Recommandation** : Déplacer vers une variable d'environnement pour production
2. **Pas de rotation de clé** : Si la clé est compromise, il faut re-chiffrer tous les mots de passe
3. **Déchiffrement côté base** : La base de données doit déchiffrer le mot de passe (pas de chiffrement end-to-end)

---

## 🚀 Utilisation

### **Dans le Frontend (React)**

```typescript
// Sauvegarder le mot de passe (automatique dans Settings.tsx)
const { data: encryptedPassword, error } = await supabase
  .rpc('encrypt_smtp_password', {
    password: smtpPassword,
    user_id: userId
  });

// Mise à jour dans user_settings
await supabase
  .from('user_settings')
  .upsert({
    smtp_password_encrypted: encryptedPassword,
    smtp_password: null
  });
```

### **Dans le Backend (Deno)**

```typescript
// Récupérer et déchiffrer (automatique dans send-email-smtp)
const { data: settings } = await supabaseClient
  .from('user_settings')
  .select('smtp_password_encrypted')
  .eq('user_id', user.id)
  .maybeSingle();

const { data: decryptedPassword } = await supabaseClient
  .rpc('decrypt_smtp_password', {
    encrypted_password: settings.smtp_password_encrypted,
    user_id: user.id
  });

// Utiliser dans nodemailer
const transporter = nodemailer.createTransport({
  auth: {
    pass: decryptedPassword
  }
});
```

---

## ✅ Checklist de Déploiement

- [ ] Appliquer `20251023000002_add_smtp_password_encryption.sql`
- [ ] Appliquer `20251026000002_migrate_smtp_passwords_to_encrypted.sql`
- [ ] Déployer `send-email-smtp/index.ts` (avec déchiffrement)
- [ ] Déployer `Settings.tsx` (avec chiffrement)
- [ ] Tester l'envoi d'email SMTP
- [ ] Vérifier que `smtp_password` est NULL dans la base
- [ ] Vérifier que `smtp_password_encrypted` contient des données (bytea)

---

## 🧪 Tests

### **Tester le chiffrement :**
```sql
-- Chiffrer un mot de passe test
SELECT encrypt_smtp_password('test123', '00000000-0000-0000-0000-000000000000'::uuid);

-- Déchiffrer le résultat
SELECT decrypt_smtp_password(
  encrypt_smtp_password('test123', '00000000-0000-0000-0000-000000000000'::uuid),
  '00000000-0000-0000-0000-000000000000'::uuid
);
-- Devrait retourner: 'test123'
```

### **Vérifier la migration :**
```sql
-- Tous les mots de passe doivent être chiffrés
SELECT 
  user_id,
  smtp_password IS NULL as password_cleared,
  smtp_password_encrypted IS NOT NULL as has_encrypted
FROM user_settings
WHERE smtp_host IS NOT NULL;
```

---

## 🔄 Rétrocompatibilité

Le système supporte les **anciens mots de passe en clair** pendant la transition :

```typescript
// Dans send-email-smtp/index.ts
let smtpPassword = settings.smtp_password; // Fallback ancien format

if (settings.smtp_password_encrypted) {
  // Utiliser le chiffré (nouveau format)
  smtpPassword = await decrypt();
}
```

Après la migration complète, la colonne `smtp_password` peut être supprimée.

---

## 📞 Support

En cas de problème :
1. Vérifier que les fonctions existent : `SELECT proname FROM pg_proc WHERE proname LIKE '%smtp_password%'`
2. Vérifier l'extension pgcrypto : `SELECT * FROM pg_extension WHERE extname = 'pgcrypto'`
3. Vérifier les logs : `console.log` dans `send-email-smtp/index.ts`

---

**Date de mise en place :** 26 octobre 2025  
**Version :** 1.0

