# 📧 Email Preview & Meeting Navigation - Documentation

## 🎯 Objectif

Améliorer l'historique des emails avec :
1. ✅ **Bouton "Voir la réunion associée"** fonctionnel
2. ✅ **Prévisualisation du contenu HTML** de l'email

---

## 🔧 Modifications Appliquées

### 1️⃣ **EmailHistory.tsx** - Interface Améliorée

#### **A. Props et State mis à jour**

```typescript
interface EmailHistoryProps {
  userId: string;
  onViewMeeting?: (meetingId: string) => void; // ✅ Nouvelle prop
}

const [previewEmail, setPreviewEmail] = useState<EmailHistoryItem | null>(null); // ✅ Nouvel état
```

#### **B. Bouton "Voir la réunion" corrigé**

**❌ Avant** (lien mort) :
```tsx
<a href={`#meeting-${email.meeting_id}`}>
  Voir la réunion associée
</a>
```

**✅ Après** (callback fonctionnel) :
```tsx
{email.meeting_id && onViewMeeting && (
  <button onClick={() => onViewMeeting(email.meeting_id!)}>
    <ExternalLink className="w-4 h-4" />
    Voir la réunion associée
  </button>
)}
```

#### **C. Nouveau bouton "Prévisualiser l'email"**

```tsx
{email.html_body && (
  <button onClick={() => setPreviewEmail(email)}>
    <Mail className="w-4 h-4" />
    Prévisualiser l'email
  </button>
)}
```

#### **D. Modal de prévisualisation**

- **Overlay semi-transparent** cliquable pour fermer
- **Header** : Sujet, destinataires, CC, date, méthode, PJ
- **Corps** : Rendu HTML complet avec `dangerouslySetInnerHTML`
- **Footer** : Bouton "Fermer"
- **Design** : Max-width 4xl, max-height 90vh, scrollable

```tsx
{previewEmail && (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
    <div className="bg-white rounded-2xl max-w-4xl max-h-[90vh]">
      {/* Header avec sujet, destinataires, date */}
      {/* Corps avec HTML */}
      {/* Footer avec bouton Fermer */}
    </div>
  </div>
)}
```

---

### 2️⃣ **App.tsx** - Passage du callback

#### **A. Nouvelle fonction `handleViewMeetingById`**

```tsx
const handleViewMeetingById = async (meetingId: string) => {
  // Chercher dans la liste existante
  const existingMeeting = meetings.find(m => m.id === meetingId);
  
  if (existingMeeting) {
    handleViewMeeting(existingMeeting);
  } else {
    // Charger depuis la DB si pas dans la liste
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .maybeSingle();
    
    if (data) {
      handleViewMeeting(data as Meeting);
    } else {
      alert('❌ Réunion introuvable');
    }
  }
};
```

**Pourquoi cette fonction ?**
- ✅ `handleViewMeeting` attend un objet `Meeting` complet
- ✅ `EmailHistory` n'a que le `meetingId` (string)
- ✅ Cette fonction fait le pont : `meetingId` → `Meeting` → `handleViewMeeting`

#### **B. Passage du callback**

```tsx
<EmailHistory 
  userId={user?.id || ''} 
  onViewMeeting={handleViewMeetingById} // ✅ Nouvelle fonction
/>
```

Lorsque l'utilisateur clique sur "Voir la réunion associée" :
1. ✅ `handleViewMeetingById(meetingId)` est appelé
2. ✅ La réunion est chargée depuis `meetings[]` ou la DB
3. ✅ `handleViewMeeting(meeting)` est appelé avec l'objet complet
4. ✅ La vue change vers `'detail'`
5. ✅ Le composant `MeetingDetail` affiche la **bonne réunion**

---

### 3️⃣ **MeetingDetail.tsx** - Enregistrement du HTML

Ajout de `html_body` dans **3 endroits** :

#### **A. Après envoi SMTP réussi**
```typescript
await supabase.from('email_history').insert({
  // ...
  html_body: emailData.htmlBody, // ✅ Ajouté
  method: 'smtp',
  status: 'sent',
});
```

#### **B. Après envoi Gmail réussi**
```typescript
await supabase.from('email_history').insert({
  // ...
  html_body: emailData.htmlBody, // ✅ Ajouté
  method: 'gmail',
  status: 'sent',
  message_id: result.messageId,
  thread_id: result.threadId,
});
```

#### **C. En cas d'échec (catch)**
```typescript
await supabase.from('email_history').insert({
  // ...
  html_body: emailData.htmlBody, // ✅ Ajouté
  method: emailMethod,
  status: 'failed',
  error_message: error.message,
});
```

---

### 4️⃣ **Base de données** - Colonne existante

La colonne `html_body` existe déjà dans la migration `20251027000002_create_email_history.sql` :

```sql
CREATE TABLE email_history (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  meeting_id uuid REFERENCES meetings(id),
  recipients text NOT NULL,
  cc_recipients text,
  subject text NOT NULL,
  html_body text, -- ✅ Déjà présent
  method text NOT NULL,
  attachments_count integer,
  total_attachments_size integer,
  status text DEFAULT 'sent',
  error_message text,
  message_id text,
  thread_id text,
  sent_at timestamptz DEFAULT now()
);
```

---

## 🚀 Déploiement

### **1. Build frontend**
```bash
npm run build
```

### **2. Redéployer sur votre hébergement**
```bash
# Exemple avec Netlify/Vercel
netlify deploy --prod
# ou
vercel --prod
```

### **3. Vérifier la base de données**
```sql
-- Vérifier que la colonne html_body existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'email_history';
```

Si la colonne n'existe pas, appliquer la migration :
```bash
cd supabase
npx supabase db push
```

---

## 🧪 Tests

### **Test 1 : Envoi d'email**
1. ✅ Envoyez un email (Gmail ou SMTP)
2. ✅ Allez dans **Historique** → **Emails envoyés**
3. ✅ Vérifiez que l'email apparaît

### **Test 2 : Prévisualisation**
1. ✅ Cliquez sur un email dans l'historique (expand)
2. ✅ Cliquez sur **"Prévisualiser l'email"**
3. ✅ Vérifiez que la modal s'ouvre
4. ✅ Vérifiez le rendu HTML (texte, signature, logo)
5. ✅ Cliquez sur overlay ou "Fermer" → modal se ferme

### **Test 3 : Navigation vers réunion**
1. ✅ Cliquez sur un email dans l'historique (expand)
2. ✅ Cliquez sur **"Voir la réunion associée"**
3. ✅ Vérifiez que la vue change vers la réunion
4. ✅ Vérifiez que le détail de la réunion s'affiche

### **Test 4 : Email sans meeting_id**
1. ✅ Envoyez un email sans réunion associée
2. ✅ Vérifiez que le bouton "Voir la réunion" n'apparaît pas

---

## 📊 Flux de données

```
┌──────────────────────────────────────────────────────────┐
│ 1. Utilisateur envoie un email (MeetingDetail.tsx)      │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Enregistrement dans email_history                     │
│    - recipients, subject, html_body, method, status      │
│    - meeting_id (nullable)                               │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Affichage dans EmailHistory.tsx                       │
│    - Liste des emails avec expand/collapse               │
└────────────────────┬─────────────────────────────────────┘
                     │
        ┌────────────┴─────────────┐
        │                          │
        ▼                          ▼
┌────────────────────┐    ┌────────────────────┐
│ 4a. Preview Email  │    │ 4b. View Meeting   │
│ - Modal HTML       │    │ - Callback parent  │
│ - Rendu complet    │    │ - Navigation       │
└────────────────────┘    └────────────────────┘
```

---

## 🎨 Design

### **Modal de prévisualisation**
- **Largeur** : max-w-4xl (responsive)
- **Hauteur** : max-h-90vh (scrollable)
- **Header** : Gradient coral → sunset
- **Corps** : Prose Tailwind CSS pour le HTML
- **Footer** : Bouton "Fermer" coral

### **Boutons dans l'historique**
- **"Voir la réunion"** : Coral-600, icône ExternalLink
- **"Prévisualiser"** : Sunset-600, icône Mail
- **Hover** : Underline + darkening

---

## ✅ Fichiers Modifiés

| Fichier | Changements |
|---------|------------|
| `src/components/EmailHistory.tsx` | Props, state, modal preview, callback button |
| `src/App.tsx` | Passage de `onViewMeeting` |
| `src/components/MeetingDetail.tsx` | Enregistrement `html_body` (3×) |
| `supabase/migrations/20251027000002_create_email_history.sql` | ✅ Déjà existant |

---

## 🐛 Corrections

### **Problème 1 : Bouton "Voir la réunion" ne marchait pas**
- **Cause** : Lien `href="#meeting-..."` non fonctionnel
- **Solution** : Remplacé par `button onClick={onViewMeeting(meetingId)}`

### **Problème 2 : Pas de preview du mail**
- **Cause** : Fonctionnalité non implémentée
- **Solution** : 
  - Ajout `html_body` dans DB
  - Création modal avec `dangerouslySetInnerHTML`
  - Bouton "Prévisualiser l'email"

---

## 🎯 Résultat

✅ **Historique des emails** :
- Vue liste avec expand/collapse
- Bouton "Voir la réunion associée" ✅ **FONCTIONNE**
- Bouton "Prévisualiser l'email" ✅ **NOUVEAU**

✅ **Modal de prévisualisation** :
- Affichage HTML complet
- Responsive et scrollable
- Design cohérent avec la charte

✅ **Navigation fluide** :
- Email → Réunion (via callback)
- Réunion → Email (via historique)

---

**🎉 Fonctionnalité complète et opérationnelle !**

