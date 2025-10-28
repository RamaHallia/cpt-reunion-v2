# ✉️ Badge "Envoyé" pour l'Historique des Réunions

## Fonctionnalité

Un badge **"Envoyé"** apparaît automatiquement à côté du titre des réunions pour lesquelles un email a été envoyé avec succès.

## Détails techniques

### 1. État local `sentMeetingIds`

Un `Set` contenant les IDs des réunions avec emails envoyés :

```typescript
const [sentMeetingIds, setSentMeetingIds] = useState<Set<string>>(new Set());
```

### 2. Chargement initial

Au chargement du composant, on interroge `email_history` :

```typescript
const { data } = await supabase
  .from('email_history')
  .select('meeting_id')
  .in('meeting_id', meetingIds)
  .eq('status', 'sent');
```

### 3. Mise à jour en temps réel

Un **Realtime Listener** écoute les nouveaux emails envoyés :

```typescript
supabase
  .channel('email_history_changes')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'email_history',
    filter: `status=eq.sent`,
  }, (payload) => {
    const newMeetingId = payload.new.meeting_id;
    if (newMeetingId && meetings.some(m => m.id === newMeetingId)) {
      setSentMeetingIds(prev => new Set([...prev, newMeetingId]));
    }
  })
  .subscribe();
```

### 4. Affichage du badge

Le badge apparaît conditionnellement dans le titre :

```tsx
{sentMeetingIds.has(meeting.id) && (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex-shrink-0">
    <Send className="w-3 h-3" />
    Envoyé
  </span>
)}
```

## Design

- **Couleur** : Vert (`bg-green-100 text-green-700`)
- **Icône** : `Send` (enveloppe avec flèche)
- **Taille** : `text-xs`, `px-2 py-0.5`
- **Forme** : `rounded-full`
- **Responsive** : `flex-shrink-0` pour éviter la déformation

## Comportement

### Avant l'envoi d'email
```
┌─────────────────────────────────┐
│ 📄 Réunion Client ABC           │
│ 28 octobre 2025 • 15:30        │
│                                 │
│ [✉️ Envoyer] [🗑️ Supprimer]    │
└─────────────────────────────────┘
```

### Après l'envoi d'email
```
┌─────────────────────────────────┐
│ 📄 Réunion Client ABC [✓ Envoyé]│
│ 28 octobre 2025 • 15:30        │
│                                 │
│ [✉️ Envoyer] [🗑️ Supprimer]    │
└─────────────────────────────────┘
```

## Cas d'usage

1. **Envoi depuis MeetingDetail** :
   - L'utilisateur clique sur "Envoyer par email"
   - Email envoyé → Insertion dans `email_history`
   - Realtime trigger → Badge apparaît instantanément

2. **Envoi depuis MeetingHistory** :
   - L'utilisateur clique sur l'icône ✉️
   - Email envoyé → Insertion dans `email_history`
   - Realtime trigger → Badge apparaît instantanément

3. **Rechargement de page** :
   - L'`useEffect` recharge les `sentMeetingIds` depuis la DB
   - Badges affichés correctement

4. **Envoi multiple** :
   - Si plusieurs emails sont envoyés pour la même réunion
   - Le badge reste "Envoyé" (pas de duplication)

## Avantages

✅ **Indicateur visuel clair** : L'utilisateur sait immédiatement quelles réunions ont été partagées  
✅ **Temps réel** : Mise à jour instantanée sans rechargement  
✅ **Performance** : Un seul `Set` en mémoire, requête SQL optimisée  
✅ **UX cohérente** : Design aligné avec la charte graphique  

## Fichiers modifiés

- `src/components/MeetingHistory.tsx` : Badge + Realtime + chargement initial

---

**Déployé** ✅

