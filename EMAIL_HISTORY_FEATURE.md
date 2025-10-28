# 📧 Fonctionnalité : Historique des Emails Envoyés

## Vue d'Ensemble

Ajout d'une section "Historique des emails" dans la page Historique, permettant aux utilisateurs de consulter tous les emails qu'ils ont envoyés depuis l'application.

---

## 🗄️ Partie 1 : Base de Données

### **Migration Créée**

**Fichier :** `supabase/migrations/20251027000002_create_email_history.sql`

**Table :** `email_history`

**Colonnes :**
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid | Clé primaire |
| `user_id` | uuid | Référence à auth.users |
| `meeting_id` | uuid | Référence à meetings (nullable) |
| `recipients` | text | Destinataires (séparés par virgules) |
| `cc_recipients` | text | CC (séparés par virgules, nullable) |
| `subject` | text | Sujet de l'email |
| `method` | text | 'gmail', 'smtp', ou 'local' |
| `html_body` | text | Corps HTML (nullable) |
| `attachments_count` | integer | Nombre de PJ |
| `total_attachments_size` | integer | Taille totale en bytes |
| `status` | text | 'sent' ou 'failed' |
| `error_message` | text | Message d'erreur si échec |
| `message_id` | text | ID Gmail/SMTP (nullable) |
| `thread_id` | text | ID thread Gmail (nullable) |
| `sent_at` | timestamptz | Date d'envoi |
| `created_at` | timestamptz | Date de création |

**Index :**
- `idx_email_history_user_id`
- `idx_email_history_meeting_id`
- `idx_email_history_sent_at`
- `idx_email_history_user_sent`

**RLS (Row Level Security) :**
- Les utilisateurs peuvent voir leurs propres emails
- Les utilisateurs peuvent insérer leurs propres emails
- Les utilisateurs peuvent supprimer leurs propres emails

---

## 🎨 Partie 2 : Interface Utilisateur

### **Composant Créé**

**Fichier :** `src/components/EmailHistory.tsx`

**Fonctionnalités :**
- ✅ Affichage de la liste des emails envoyés
- ✅ Tri par date (plus récent en premier)
- ✅ Limite aux 50 derniers emails
- ✅ Expand/collapse pour voir les détails
- ✅ Badge coloré selon la méthode (Gmail/SMTP/Local)
- ✅ Icône de statut (succès/échec)
- ✅ Affichage des pièces jointes (nombre + taille)
- ✅ Lien vers la réunion associée
- ✅ Suppression d'emails
- ✅ Format de date relatif ("Il y a 2h")

### **Intégration dans App.tsx**

**Modifications :**
1. ✅ Import du composant `EmailHistory`
2. ✅ Ajout d'un état `historyTab` ('meetings' | 'emails')
3. ✅ Onglets dans la vue Historique
4. ✅ Affichage conditionnel selon l'onglet

---

## 📝 Partie 3 : Enregistrement des Emails

### **À FAIRE : Modifier MeetingDetail.tsx**

Après chaque envoi d'email réussi, il faut enregistrer dans `email_history` :

**Exemple de code à ajouter après l'envoi SMTP :**

```typescript
// Après: alert('✅ Email envoyé avec succès !');

// Enregistrer dans l'historique
const attachmentsSize = emailData.attachments.reduce((sum, att) => {
  return sum + ((att.content.length * 3) / 4); // Taille base64 -> bytes
}, 0);

await supabase.from('email_history').insert({
  user_id: session.user.id,
  meeting_id: meeting?.id || null,
  recipients: emailData.recipients.map(r => r.email).join(', '),
  cc_recipients: emailData.ccRecipients.length > 0 
    ? emailData.ccRecipients.map(r => r.email).join(', ') 
    : null,
  subject: emailData.subject,
  method: 'smtp',
  attachments_count: emailData.attachments.length,
  total_attachments_size: Math.round(attachmentsSize),
  status: 'sent',
});
```

**Exemple de code pour Gmail :**

```typescript
// Après: alert('✅ Email envoyé avec succès via votre compte Gmail !');

// Enregistrer dans l'historique
const attachmentsSize = emailData.attachments.reduce((sum, att) => {
  return sum + ((att.content.length * 3) / 4);
}, 0);

await supabase.from('email_history').insert({
  user_id: session.user.id,
  meeting_id: meeting?.id || null,
  recipients: emailData.recipients.map(r => r.email).join(', '),
  cc_recipients: emailData.ccRecipients.length > 0 
    ? emailData.ccRecipients.map(r => r.email).join(', ') 
    : null,
  subject: emailData.subject,
  method: 'gmail',
  attachments_count: emailData.attachments.length,
  total_attachments_size: Math.round(attachmentsSize),
  status: 'sent',
  message_id: result.messageId || null,
  thread_id: result.threadId || null,
});
```

**En cas d'erreur :**

```typescript
// Dans le catch:
await supabase.from('email_history').insert({
  user_id: session.user.id,
  meeting_id: meeting?.id || null,
  recipients: emailData.recipients.map(r => r.email).join(', '),
  cc_recipients: emailData.ccRecipients.length > 0 
    ? emailData.ccRecipients.map(r => r.email).join(', ') 
    : null,
  subject: emailData.subject,
  method: emailMethod,
  attachments_count: emailData.attachments.length,
  status: 'failed',
  error_message: error.message,
});
```

---

## 🚀 Déploiement

### **Étapes :**

1. ✅ **Appliquer la migration :**
   ```bash
   cd supabase
   npx supabase db push
   ```

2. ✅ **Vérifier que les fichiers sont créés :**
   - `supabase/migrations/20251027000002_create_email_history.sql`
   - `src/components/EmailHistory.tsx`
   - Modifications dans `src/App.tsx`

3. ⏳ **Modifier MeetingDetail.tsx :**
   - Ajouter l'enregistrement après chaque envoi
   - Gérer les succès et échecs

4. ✅ **Tester :**
   - Envoyer un email par Gmail
   - Envoyer un email par SMTP
   - Vérifier l'affichage dans l'onglet "Emails envoyés"
   - Tester la suppression
   - Tester le lien vers la réunion

5. ✅ **Build et déploiement :**
   ```bash
   npm run build
   # Puis déployer
   ```

---

## 🎨 Aperçu Visuel

```
┌─────────────────────────────────────────────────────────┐
│ Historique                                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [Réunions] [Emails envoyés] ← Onglets                 │
│ ─────────── ──────────                                 │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐│
│ │ ✅ Compte-rendu réunion client          [🗑️]        ││
│ │ 👤 client@company.com +2 CC                         ││
│ │ 📅 Il y a 2h  📎 3 PJ (4.5MB)  [Gmail]             ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ ┌─────────────────────────────────────────────────────┐│
│ │ ✅ Proposition commerciale              [🗑️]        ││
│ │ 👤 prospect@startup.io                              ││
│ │ 📅 Il y a 1j  📎 1 PJ (2.1MB)  [SMTP]              ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ ┌─────────────────────────────────────────────────────┐│
│ │ ❌ Email test (échec)                   [🗑️]        ││
│ │ 👤 test@example.com                                 ││
│ │ 📅 Il y a 3j  [Local]                               ││
│ │ ⚠️ Erreur: SMTP configuration incomplete            ││
│ └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Statistiques Possibles (Future)

L'historique des emails permet d'ajouter des statistiques :

- **Total emails envoyés**
- **Taux de succès** (sent vs failed)
- **Volume de données envoyées** (MB)
- **Méthode la plus utilisée** (Gmail vs SMTP)
- **Emails par mois** (graphique)

---

## ✅ Checklist

- [x] Migration `email_history` créée
- [x] Composant `EmailHistory` créé
- [x] Onglets ajoutés dans App.tsx
- [ ] Enregistrement après envoi SMTP (à faire)
- [ ] Enregistrement après envoi Gmail (à faire)
- [ ] Enregistrement en cas d'échec (à faire)
- [ ] Migration appliquée
- [ ] Tests end-to-end
- [ ] Déployé en production

---

**Date de création :** 27 octobre 2025  
**Version :** 1.0  
**Status :** ⏳ Interface créée, enregistrement à implémenter

