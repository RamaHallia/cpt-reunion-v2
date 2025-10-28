# 🎬 Flux Visuel : Enregistrement → Résultat

## Vue d'ensemble animée

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 1 : ENREGISTREMENT                 │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐
│  🎤 Enregistrement en cours  │
│  ●  00:42                    │
│  ▓▓▓▓▓▓▓▓░░░░                │
│                              │
│     [⏹ Arrêter]              │
└──────────────────────────────┘
                ↓
      Utilisateur clique sur "Arrêter"
                ↓

┌─────────────────────────────────────────────────────────────┐
│                    PHASE 2 : TRAITEMENT                     │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐
│                              │
│         🔄 (spinner)         │ ← ProcessingModal
│                              │    z-index: 90
│       Processing...          │
│                              │
│  Création de la réunion...   │ ← processingStatus (étape 1)
│                              │
└──────────────────────────────┘
                ↓ (0.5s)

┌──────────────────────────────┐
│                              │
│         🔄 (spinner)         │
│                              │
│       Processing...          │
│                              │
│ Finalisation transcription...│ ← processingStatus (étape 2)
│                              │
└──────────────────────────────┘
                ↓ (1s)

┌──────────────────────────────┐
│                              │
│         🔄 (spinner)         │
│                              │
│       Processing...          │
│                              │
│ Génération du résumé IA...   │ ← processingStatus (étape 3)
│                              │
└──────────────────────────────┘
                ↓ (8-15s)

┌─────────────────────────────────────────────────────────────┐
│                    PHASE 3 : RÉSULTAT                       │
└─────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────┐
│ ❌                                     │
│                                       │
│  📝 Réunion Client XYZ                │ ← MeetingResult
│  📅 27 octobre 2025, 14:30            │    z-index: 100
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ [Résumé] [Transcription] [...]  │ │
│  └─────────────────────────────────┘ │
│                                       │
│  📊 Résumé IA                         │
│  ═══════════════════════════════     │
│  Cette réunion concernait...          │
│                                       │
│  Points clés:                         │
│  • Décision sur le budget             │
│  • Prochaine deadline: 15 nov         │
│  • Actions à mener                    │
│                                       │
│  ┌──────────┬──────────┬──────────┐  │
│  │ 📧 Email │ 📄 PDF   │ 📋 Copier│  │
│  └──────────┴──────────┴──────────┘  │
│                                       │
└───────────────────────────────────────┘
```

## Timeline détaillée

```
Temps   État              Modal affiché         Z-index    Actions
─────────────────────────────────────────────────────────────────────
t=0s    Arrêt recording   -                     -          handleStopRecording()
        
t=0.1s  isProcessing=true ProcessingModal       90         🔄 Visible
                          "Création..."

t=0.5s  Création DB       ProcessingModal       90         💾 INSERT meetings
                          "Création..."

t=1s    Transcription     ProcessingModal       90         📝 Formatage transcript
                          "Finalisation..."

t=2s    Appel IA          ProcessingModal       90         🤖 OpenAI GPT-4
                          "Génération..."

t=10s   Résumé reçu       ProcessingModal       90         ✅ UPDATE meetings
                          "Génération..."

t=10.1s isProcessing=false -                    -          ProcessingModal disparaît

t=10.2s result set        MeetingResult         100        🎯 Modal résultat visible
        
t=∞     Attente user      MeetingResult         100        👤 User lit le résumé
```

## Diagramme de séquence

```
Utilisateur         App.tsx          ProcessingModal    OpenAI        MeetingResult
    |                  |                     |             |                |
    |--[Arrêter]------>|                     |             |                |
    |                  |                     |             |                |
    |                  |--setIsProcessing(true)----------->|                |
    |                  |                     |             |                |
    |                  |--setStatus("Création...")-------->|                |
    |                  |                     |             |                |
    |           [ProcessingModal visible]    |             |                |
    |                  |                     |             |                |
    |                  |--INSERT meetings--->|             |                |
    |                  |<-------OK-----------|             |                |
    |                  |                     |             |                |
    |                  |--setStatus("Finalisation...")---->|                |
    |                  |                     |             |                |
    |                  |--Format transcript->|             |                |
    |                  |                     |             |                |
    |                  |--setStatus("Génération...")------>|                |
    |                  |                     |             |                |
    |                  |--generateSummary()---------------->|                |
    |                  |                     |             |                |
    |                  |             [Appel OpenAI GPT-4]  |                |
    |                  |                     |           [8-15s]            |
    |                  |                     |             |                |
    |                  |<------Résumé IA------------------<|                |
    |                  |                     |             |                |
    |                  |--UPDATE meetings--->|             |                |
    |                  |<-------OK-----------|             |                |
    |                  |                     |             |                |
    |                  |--setIsProcessing(false)---------->|                |
    |                  |                     |             |                |
    |           [ProcessingModal disparaît]  |             |                |
    |                  |                     |             |                |
    |                  |--setResult(data)----------------------------------->|
    |                  |                     |             |                |
    |                  |                     |             |  [MeetingResult|
    |                  |                     |             |     visible]   |
    |                  |                     |             |                |
    |<-----------------[Modal résultat affiché]----------------------------|
    |                  |                     |             |                |
```

## États des modals

### ProcessingModal (pendant)
```
┌─────────────────────────┐
│  Propriété   │  Valeur  │
├─────────────────────────┤
│  isOpen      │  true    │ ← Contrôlé par isProcessing
│  status      │  string  │ ← Dynamique (3 messages)
│  z-index     │  90      │ ← Sous MeetingResult
│  backdrop    │  50%     │ ← Fond semi-transparent
│  closeable   │  false   │ ← Pas de fermeture manuelle
└─────────────────────────┘
```

### MeetingResult (après)
```
┌─────────────────────────┐
│  Propriété   │  Valeur  │
├─────────────────────────┤
│  visible     │  true    │ ← Contrôlé par result !== null
│  title       │  string  │ ← Titre de la réunion
│  summary     │  string  │ ← Résumé IA
│  z-index     │  100     │ ← Au-dessus de tout
│  backdrop    │  50%     │ ← Fond semi-transparent
│  closeable   │  true    │ ← Fermeture manuelle (❌)
└─────────────────────────┘
```

## Superposition des z-index

```
Vue de côté (z-axis) :

        z=100   ┌─────────────────┐
                │ MeetingResult   │ ← Le plus proche de l'utilisateur
                │  (Résultat IA)  │
                └─────────────────┘

        z=90    ┌─────────────────┐
                │ ProcessingModal │ ← Loader pendant traitement
                │  (Spinner + msg)│
                └─────────────────┘

        z=50    ┌─────────────────┐
                │ ProcessingStatus│ ← Background tasks (uploads)
                │     Modal       │
                └─────────────────┘

        z=0     ┌─────────────────┐
                │   Page content  │ ← Contenu normal
                │  (Dashboard,    │
                │   History, etc) │
                └─────────────────┘
```

## Comportement responsive

### Desktop (> 768px)
```
┌──────────────────────────────────────┐
│                                      │
│  ┌────────────────────────────────┐ │
│  │                                │ │
│  │    🔄 Processing...            │ │
│  │                                │ │
│  │ Génération du résumé IA...     │ │
│  │                                │ │
│  └────────────────────────────────┘ │
│                                      │
└──────────────────────────────────────┘
         (Centré, max-width: 28rem)
```

### Mobile (< 768px)
```
┌──────────────────┐
│                  │
│ ┌──────────────┐ │
│ │              │ │
│ │🔄 Process... │ │
│ │              │ │
│ │Génération... │ │
│ │              │ │
│ └──────────────┘ │
│                  │
└──────────────────┘
  (Padding réduit)
```

## Code snippets clés

### Rendu des modals dans App.tsx
```tsx
// 1. Loader pendant traitement (z-90)
<ProcessingModal
  isOpen={isProcessing}
  status={processingStatus || 'Traitement en cours...'}
/>

// 2. Résultat après traitement (z-100)
{result && result.title && result.summary && (
  <div className="fixed inset-0 z-[100]">
    <MeetingResult
      title={result.title}
      transcript={result.transcript}
      summary={result.summary}
      onClose={() => setResult(null)}
    />
  </div>
)}
```

### Logique de traitement
```typescript
const processRecording = async () => {
  setIsProcessing(true); // ← Ouvre ProcessingModal
  
  try {
    setProcessingStatus('Création...');
    // ... création réunion
    
    setProcessingStatus('Finalisation...');
    // ... transcription
    
    setProcessingStatus('Génération...');
    const result = await generateSummary(transcript);
    
    setResult({ title, transcript, summary }); // ← Ouvre MeetingResult
  } finally {
    setIsProcessing(false); // ← Ferme ProcessingModal
  }
};
```

## Messages de statut (localisation FR)

```javascript
const STATUS_MESSAGES = {
  CREATION: 'Création de la réunion...',
  TRANSCRIPTION: 'Finalisation de la transcription...',
  SUMMARY: 'Génération du résumé IA...',
  ERROR: 'Une erreur est survenue'
};
```

## Tests utilisateur

### Checklist UX
- [ ] Le spinner apparaît immédiatement après "Arrêter"
- [ ] Les 3 messages de statut s'affichent séquentiellement
- [ ] Le spinner disparaît avant l'affichage du résultat
- [ ] Le modal de résultat apparaît avec animation
- [ ] Les boutons du modal de résultat sont cliquables
- [ ] Le bouton "Fermer" (❌) fonctionne
- [ ] Pas de "flash" entre les deux modals

### Métriques de performance
- **Temps total** : 10-15 secondes (normal)
- **Temps perçu** : Réduit grâce aux messages de statut
- **Feedback visuel** : Continu (pas de "trou noir")

---

**Statut** : ✅ Flux restauré et documenté
**Date** : 2025-10-27
**Version** : 1.0.2

