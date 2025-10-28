# 🔍 Filtres de Recherche pour l'Historique des Emails

## 📋 Vue d'ensemble

Ajout de filtres de recherche avancés dans la section "Emails envoyés" de l'historique, permettant aux utilisateurs de retrouver rapidement des emails spécifiques.

---

## ✨ Fonctionnalités

### 1. **Barre de Recherche Textuelle**
- **Recherche dans** :
  - Sujet de l'email
  - Destinataires (To)
  - Destinataires en copie (CC)
- **Recherche en temps réel** (sans validation)
- **Bouton X** pour effacer la recherche rapidement

### 2. **Filtre par Méthode d'Envoi**
- **Toutes** : Affiche tous les emails
- **Gmail** : Uniquement les emails envoyés via Gmail API
- **SMTP** : Uniquement les emails envoyés via SMTP

### 3. **Filtre par Statut**
- **Tous** : Affiche tous les statuts
- **Envoyés** : Uniquement les emails envoyés avec succès
- **Échecs** : Uniquement les emails en erreur

### 4. **Filtre par Période**
- **Toutes** : Tous les emails
- **Aujourd'hui** : Dernières 24 heures
- **Cette semaine** : Derniers 7 jours
- **Ce mois** : Derniers 30 jours

### 5. **Compteur de Résultats**
- Affiche `X/Y` (résultats filtrés / total)
- Ex: `12/45` = 12 emails affichés sur 45 au total

### 6. **Badge de Filtres Actifs**
- Bouton "Filtres" change de couleur si des filtres sont actifs
- Badge avec le nombre de filtres appliqués
- Ex: `Filtres [3]` = 3 filtres actifs

### 7. **Réinitialisation Rapide**
- Bouton "Réinitialiser les filtres" pour tout effacer
- Disponible dans le panneau de filtres
- Disponible dans le message "Aucun résultat"

---

## 🎨 Design

### Bouton Filtres
```
┌─────────────────────────────────────┐
│  Historique (12/45)   [Filtres 3]  │  <- Badge rouge si actifs
└─────────────────────────────────────┘
```

### Panneau de Filtres (Dépliable)
```
┌───────────────────────────────────────────────────┐
│  🔍 [Rechercher par sujet, destinataire...]  [X]  │
│                                                   │
│  ┌─────────────┬─────────────┬─────────────┐    │
│  │ Méthode     │ Statut      │ Période     │    │
│  │ [Toutes ▼]  │ [Tous ▼]    │ [Toutes ▼]  │    │
│  └─────────────┴─────────────┴─────────────┘    │
│                                                   │
│                    [🔄 Réinitialiser les filtres] │
└───────────────────────────────────────────────────┘
```

### Message Aucun Résultat
```
┌───────────────────────────────────────┐
│             🔍                        │
│                                       │
│     Aucun email trouvé                │
│     Essayez de modifier vos filtres   │
│                                       │
│     [Réinitialiser les filtres]       │
└───────────────────────────────────────┘
```

---

## 🎯 Logique de Filtrage

### Combinaison des Filtres (ET logique)
Tous les filtres sont combinés avec un **ET** logique :
- Recherche textuelle **ET** Méthode **ET** Statut **ET** Période

### Exemple
**Filtres** :
- Recherche : `"rapport"`
- Méthode : `Gmail`
- Statut : `Envoyés`
- Période : `Cette semaine`

**Résultat** : Emails qui contiennent "rapport" **ET** envoyés via Gmail **ET** avec succès **ET** dans les 7 derniers jours

---

## 💻 Implémentation Technique

### États React
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [filterMethod, setFilterMethod] = useState<'all' | 'gmail' | 'smtp'>('all');
const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'failed'>('all');
const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
const [showFilters, setShowFilters] = useState(false);
```

### Fonction de Filtrage
```typescript
const filteredEmails = emails.filter((email) => {
  // Recherche textuelle
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    const matchesSubject = email.subject.toLowerCase().includes(query);
    const matchesRecipients = email.recipients.toLowerCase().includes(query);
    const matchesCC = email.cc_recipients?.toLowerCase().includes(query);
    if (!matchesSubject && !matchesRecipients && !matchesCC) return false;
  }

  // Filtre de méthode
  if (filterMethod !== 'all' && email.method !== filterMethod) return false;

  // Filtre de statut
  if (filterStatus !== 'all' && email.status !== filterStatus) return false;

  // Filtre de date
  if (filterDateRange !== 'all') {
    const emailDate = new Date(email.sent_at);
    const now = new Date();
    const diffHours = (now.getTime() - emailDate.getTime()) / (1000 * 60 * 60);
    
    if (filterDateRange === 'today' && diffHours > 24) return false;
    if (filterDateRange === 'week' && diffHours > 24 * 7) return false;
    if (filterDateRange === 'month' && diffHours > 24 * 30) return false;
  }

  return true;
});
```

### Détection des Filtres Actifs
```typescript
const hasActiveFilters = 
  searchQuery || 
  filterMethod !== 'all' || 
  filterStatus !== 'all' || 
  filterDateRange !== 'all';
```

---

## 🧪 Tests de Validation

### Test 1 : Recherche Textuelle
1. Aller dans "Historique" → "Emails envoyés"
2. Cliquer sur "Filtres"
3. Taper "réunion" dans la barre de recherche
4. **Vérifier** :
   - ✅ Seuls les emails avec "réunion" dans le sujet/destinataires s'affichent
   - ✅ Compteur mis à jour (ex: `5/45`)
   - ✅ Badge `Filtres [1]` affiché

### Test 2 : Filtre par Méthode
1. Sélectionner "Gmail" dans le filtre "Méthode d'envoi"
2. **Vérifier** :
   - ✅ Seuls les emails avec badge "Gmail" s'affichent
   - ✅ Badge `Filtres [1]` affiché

### Test 3 : Filtre par Statut
1. Sélectionner "Échecs" dans le filtre "Statut"
2. **Vérifier** :
   - ✅ Seuls les emails avec icône ❌ (XCircle) s'affichent
   - ✅ Compteur mis à jour

### Test 4 : Filtre par Période
1. Sélectionner "Aujourd'hui" dans le filtre "Période"
2. **Vérifier** :
   - ✅ Seuls les emails des dernières 24h s'affichent
   - ✅ Emails plus anciens masqués

### Test 5 : Combinaison de Filtres
1. Recherche : "rapport"
2. Méthode : "Gmail"
3. Période : "Cette semaine"
4. **Vérifier** :
   - ✅ Seuls les emails qui respectent **tous** les critères s'affichent
   - ✅ Badge `Filtres [3]` affiché
   - ✅ Compteur correct

### Test 6 : Aucun Résultat
1. Appliquer des filtres très restrictifs
2. **Vérifier** :
   - ✅ Message "Aucun email trouvé" affiché
   - ✅ Bouton "Réinitialiser les filtres" visible
   - ✅ Clic sur le bouton efface tous les filtres

### Test 7 : Réinitialisation
1. Appliquer plusieurs filtres
2. Cliquer "Réinitialiser les filtres"
3. **Vérifier** :
   - ✅ Tous les filtres remis à "all"
   - ✅ Barre de recherche vidée
   - ✅ Tous les emails réaffichés
   - ✅ Badge "Filtres" redevient gris

---

## 📂 Fichiers Modifiés

### `src/components/EmailHistory.tsx`

**Imports ajoutés** :
```typescript
import { Search, Filter, X } from 'lucide-react';
```

**États ajoutés** :
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [filterMethod, setFilterMethod] = useState<'all' | 'gmail' | 'smtp'>('all');
const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'failed'>('all');
const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
const [showFilters, setShowFilters] = useState(false);
```

**Fonctions ajoutées** :
- `filteredEmails` : Filtre les emails selon les critères
- `resetFilters()` : Réinitialise tous les filtres
- `hasActiveFilters` : Détecte si des filtres sont actifs

**UI ajoutée** :
- Bouton "Filtres" avec badge
- Panneau de filtres dépliable
- Barre de recherche avec icône X
- 3 selects (Méthode, Statut, Période)
- Bouton "Réinitialiser les filtres"
- Message "Aucun résultat"

---

## 🎨 Styles et Animations

### Animation d'Ouverture
Le panneau de filtres utilise `animate-slideDown` (déjà existant dans `index.css`)

### Couleurs
- **Bouton Filtres (inactif)** : `bg-coral-100 text-coral-700`
- **Bouton Filtres (actif)** : `bg-coral-500 text-white`
- **Badge compteur** : `bg-white text-coral-600`
- **Panneau filtres** : `from-coral-50 to-sunset-50`
- **Inputs** : Bordure `border-coral-200` → `border-coral-500` (focus)

---

## 🚀 Déploiement

### Checklist
- [x] États des filtres ajoutés
- [x] Logique de filtrage implémentée
- [x] UI des filtres créée
- [x] Compteur de résultats
- [x] Badge de filtres actifs
- [x] Réinitialisation des filtres
- [x] Message "Aucun résultat"
- [x] Linter OK (no errors)
- [ ] Tests de validation effectués
- [ ] Build Vite (`npm run build`)
- [ ] Déployé sur production

### Commandes
```bash
# Build
npm run build

# Déployer
git add .
git commit -m "feat: Filtres de recherche pour historique des emails"
git push origin main
```

---

## 📊 Améliorations Futures (Optionnel)

### 1. **Filtre par Pièces Jointes**
```typescript
<select>
  <option value="all">Toutes</option>
  <option value="with">Avec PJ</option>
  <option value="without">Sans PJ</option>
</select>
```

### 2. **Filtre par Taille**
```typescript
<select>
  <option value="all">Toutes tailles</option>
  <option value="small">< 1 MB</option>
  <option value="medium">1-5 MB</option>
  <option value="large">> 5 MB</option>
</select>
```

### 3. **Tri Personnalisé**
```typescript
<select>
  <option value="date_desc">Plus récent</option>
  <option value="date_asc">Plus ancien</option>
  <option value="subject_asc">Sujet A-Z</option>
  <option value="subject_desc">Sujet Z-A</option>
</select>
```

### 4. **Sauvegarde des Filtres**
- Sauvegarder les filtres dans `localStorage`
- Restaurer automatiquement au chargement

### 5. **Export Filtré**
- Bouton "Exporter (CSV)" pour exporter les résultats filtrés

---

## ✅ Résumé

### Avant ❌
- Pas de recherche
- Difficile de retrouver un email spécifique
- Scroll infini dans la liste

### Après ✅
- **Recherche textuelle** (sujet, destinataires)
- **4 filtres** (Méthode, Statut, Période, Recherche)
- **Compteur de résultats** (X/Y)
- **Badge de filtres actifs**
- **Réinitialisation rapide**
- **Message "Aucun résultat"** avec bouton de reset

🎉 **Recherche rapide et efficace dans l'historique des emails !**

