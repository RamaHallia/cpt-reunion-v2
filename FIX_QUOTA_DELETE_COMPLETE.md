# 🐛 Fix Complet : Quota Diminuait lors de Suppressions (2 problèmes)

## 🎯 Résumé du Problème

Quand un utilisateur supprimait une réunion de l'historique, **le quota de minutes diminuait** alors qu'il devrait rester stable (les minutes consommées sont définitives).

**Cause :** Il y avait **DEUX endroits** qui recalculaient le quota au lieu de l'incrémenter :
1. ❌ **Backend SQL** : Trigger qui recalculait le SUM() des meetings
2. ❌ **Frontend Dashboard** : Code qui écrasait le quota DB avec un recalcul

---

## 🔧 Fix #1 : Backend SQL (Trigger)

### **Problème**

**Fichier :** `supabase/migrations/20251026000000_auto_update_quota_on_meeting_insert.sql`

```sql
-- ❌ ANCIEN CODE (Bugué)
CREATE OR REPLACE FUNCTION update_user_quota_on_meeting_insert()
BEGIN
  -- Recalcule le TOTAL à chaque INSERT
  SELECT COALESCE(SUM(ROUND(duration / 60.0)), 0)
  INTO total_minutes_used
  FROM meetings
  WHERE user_id = NEW.user_id
    AND created_at >= user_cycle_start;
  
  -- Écrase avec le total recalculé
  UPDATE user_subscriptions
  SET minutes_used_this_month = total_minutes_used
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
```

**Conséquence :**
```
1. INSERT 100min → SUM() = 100 → quota = 100 ✅
2. INSERT 50min  → SUM() = 150 → quota = 150 ✅
3. DELETE 50min  → (pas de trigger)
4. INSERT 20min  → SUM() = 120 → quota = 120 ❌ (devrait être 170)
```

### **Solution**

**Fichier :** `supabase/migrations/20251027000000_fix_quota_no_recalculate.sql`

```sql
-- ✅ NOUVEAU CODE (Corrigé)
CREATE OR REPLACE FUNCTION update_user_quota_on_meeting_insert()
BEGIN
  -- Calculer UNIQUEMENT les minutes de cette réunion
  meeting_minutes := ROUND(NEW.duration / 60.0);
  
  -- INCRÉMENTER (ne pas recalculer)
  UPDATE user_subscriptions
  SET 
    minutes_used_this_month = COALESCE(minutes_used_this_month, 0) + meeting_minutes,
    updated_at = now()
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
```

**Résultat :**
```
1. INSERT 100min → quota += 100 → quota = 100 ✅
2. INSERT 50min  → quota += 50  → quota = 150 ✅
3. DELETE 50min  → (pas de trigger) → quota = 150 ✅
4. INSERT 20min  → quota += 20  → quota = 170 ✅
```

---

## 🔧 Fix #2 : Frontend Dashboard

### **Problème**

**Fichier :** `src/components/Dashboard.tsx`  
**Lignes :** 77-81, 119-124

```typescript
// ❌ ANCIEN CODE (Bugué)

// 1. Recalcule depuis les meetings
const thisMonthMeetings = meetings.filter(m =>
  new Date(m.created_at) >= startOfMonth
);
const thisMonthSeconds = thisMonthMeetings.reduce((sum, m) => sum + (m.duration || 0), 0);
const thisMonthMinutes = Math.round(thisMonthSeconds / 60);

// 2. ÉCRASE le quota DB avec le recalcul
if (subData) {
  setSubscription({
    ...subData,
    minutes_used_this_month: thisMonthMinutes  // ❌ Écrase la DB
  });
}
```

**Conséquence :**

Même si la base de données a le bon quota (géré par le trigger), le Dashboard l'écrase avec un recalcul basé sur les meetings existantes. Si une meeting est supprimée, le recalcul donne un nombre plus bas.

### **Solution**

**Fichier :** `src/components/Dashboard.tsx`

```typescript
// ✅ NOUVEAU CODE (Corrigé)

// 1. Utiliser billing_cycle_start au lieu de startOfMonth
const cycleStart = subData?.billing_cycle_start 
  ? new Date(subData.billing_cycle_start)
  : new Date(now.getFullYear(), now.getMonth(), 1);

const thisMonthMeetings = meetings.filter(m =>
  new Date(m.created_at) >= cycleStart
);
const thisMonthSeconds = thisMonthMeetings.reduce((sum, m) => sum + (m.duration || 0), 0);

// ⚠️ NE PAS utiliser thisMonthMinutes pour le quota ! 
// thisMonthSeconds est UNIQUEMENT pour les stats d'affichage

// 2. Garder minutes_used_this_month tel quel depuis la DB
if (subData) {
  setSubscription(subData); // ✅ Pas de recalcul, utiliser la DB
}
```

**Résultat :**

Le Dashboard utilise directement `minutes_used_this_month` depuis la base de données, qui est maintenue correctement par le trigger SQL. Aucun recalcul côté frontend.

---

## 📊 Comparaison Avant/Après

### **Scénario de Test :**

```
Actions:
1. User crée meeting 100min
2. User crée meeting 50min
3. User supprime meeting 50min
4. User crée meeting 20min
```

### **Avant (Bugué) :**

| Action | Backend SQL | Frontend Dashboard | Affichage Final |
|--------|-------------|-------------------|-----------------|
| INSERT 100min | SUM() = 100 | Recalcule = 100 | **100** ✅ |
| INSERT 50min | SUM() = 150 | Recalcule = 150 | **150** ✅ |
| DELETE 50min | - | Recalcule = 100 | **100** ❌ |
| INSERT 20min | SUM() = 120 | Recalcule = 120 | **120** ❌ |

**Quota final : 120 minutes** (devrait être 170) ❌

### **Après (Corrigé) :**

| Action | Backend SQL | Frontend Dashboard | Affichage Final |
|--------|-------------|-------------------|-----------------|
| INSERT 100min | += 100 (100) | Lit DB = 100 | **100** ✅ |
| INSERT 50min | += 50 (150) | Lit DB = 150 | **150** ✅ |
| DELETE 50min | - | Lit DB = 150 | **150** ✅ |
| INSERT 20min | += 20 (170) | Lit DB = 170 | **170** ✅ |

**Quota final : 170 minutes** ✅

---

## 🚀 Déploiement

### **Étapes Obligatoires :**

1. ✅ **Appliquer la migration SQL :**
   ```bash
   cd supabase
   npx supabase db push
   ```

2. ✅ **Recalibrer les quotas existants (UNE FOIS) :**
   
   **Option A : Reset à 0 (simple)**
   ```sql
   UPDATE user_subscriptions
   SET minutes_used_this_month = 0;
   ```
   
   **Option B : Recalcul précis (recommandé)**
   ```sql
   DO $$
   DECLARE
     user_record RECORD;
     total_minutes integer;
   BEGIN
     FOR user_record IN 
       SELECT user_id, billing_cycle_start FROM user_subscriptions
     LOOP
       SELECT COALESCE(SUM(ROUND(duration / 60.0)), 0)
       INTO total_minutes
       FROM meetings
       WHERE user_id = user_record.user_id
         AND created_at >= user_record.billing_cycle_start;
       
       UPDATE user_subscriptions
       SET minutes_used_this_month = total_minutes
       WHERE user_id = user_record.user_id;
       
       RAISE NOTICE 'User %: % minutes', user_record.user_id, total_minutes;
     END LOOP;
   END $$;
   ```

3. ✅ **Déployer le frontend :**
   ```bash
   npm run build
   # Puis déployer
   ```

---

## 🧪 Tests Critiques

### **Test 1 : Création de Réunions**
1. ✅ Créer réunion 10min → Quota = 10
2. ✅ Créer réunion 5min → Quota = 15
3. ✅ Vérifier Dashboard affiche 15

### **Test 2 : Suppression (CRITIQUE)**
1. ✅ Quota actuel = 15
2. ✅ Supprimer la réunion de 10min
3. ✅ **Vérifier que quota reste à 15** ✅
4. ✅ Recharger la page
5. ✅ **Vérifier que Dashboard affiche toujours 15** ✅

### **Test 3 : Suppression puis Création**
1. ✅ Quota actuel = 15
2. ✅ Supprimer réunion de 5min
3. ✅ Quota reste à 15
4. ✅ Créer nouvelle réunion de 8min
5. ✅ **Quota = 15 + 8 = 23** ✅
6. ✅ Dashboard affiche 23

### **Test 4 : Barre de Progression**
1. ✅ Plan Starter (600 min)
2. ✅ Quota = 450 min
3. ✅ Barre affiche 75% (450/600)
4. ✅ Supprimer réunion de 50min
5. ✅ **Barre reste à 75%** ✅

---

## 📁 Fichiers Modifiés

| Fichier | Type | Description |
|---------|------|-------------|
| `supabase/migrations/20251027000000_fix_quota_no_recalculate.sql` | ✅ Nouveau | Migration SQL qui corrige le trigger |
| `src/components/Dashboard.tsx` | 🔧 Modifié | Retrait du recalcul, utilise DB directement |
| `FIX_QUOTA_DELETE_COMPLETE.md` | 📝 Doc | Ce document |

---

## ⚠️ Points Importants

### **Règles de Gestion :**

1. ✅ **Minutes consommées = DÉFINITIVES**
   - Une fois enregistrée, une minute compte
   - Supprimer l'historique ne restitue PAS les minutes

2. ✅ **Quota ne peut QUE monter**
   - Pendant le cycle de facturation
   - Chaque enregistrement AJOUTE des minutes
   - Aucune action ne peut RETIRER des minutes

3. ✅ **Reset uniquement par CRON**
   - Fonction `reset_monthly_quotas()`
   - Exécutée quotidiennement, vérifie `billing_cycle_end`
   - Reset individuel par utilisateur (pas calendaire)

4. ✅ **Source de vérité = Base de Données**
   - `user_subscriptions.minutes_used_this_month` est LA référence
   - Le frontend ne fait que LIRE cette valeur
   - Seul le trigger SQL peut la MODIFIER (+ CRON reset)

---

## 🎓 Leçons Apprises

### **Principe Architecture :**

> **Pour un compteur de consommation :**
> 1. Backend SQL : INCRÉMENTER uniquement (jamais recalculer)
> 2. Frontend : LIRE uniquement (jamais modifier)
> 3. Source de vérité = Base de données

### **Erreurs à Éviter :**

❌ Recalculer le quota depuis les données sources (meetings)  
❌ Écraser la valeur DB avec un calcul frontend  
❌ Dépendre de l'état des tables sources (DELETE affecte le calcul)  

✅ Incrémenter à chaque ajout  
✅ Lire directement depuis la DB  
✅ Indépendance vis-à-vis des données sources  

---

## ✅ Checklist de Validation

Après déploiement :

- [ ] Migration SQL appliquée sans erreur
- [ ] Fonction `update_user_quota_on_meeting_insert()` utilise `+=`
- [ ] Dashboard lit `minutes_used_this_month` depuis DB
- [ ] Créer réunion → Quota augmente
- [ ] Supprimer réunion → Quota reste stable
- [ ] Recharger page → Quota toujours stable
- [ ] Créer réunion après suppression → Quota augmente correctement
- [ ] Barre de progression correcte
- [ ] Aucune erreur console

---

**Date de correction :** 27 octobre 2025  
**Version :** 2.0 (Fix Complet Backend + Frontend)  
**Status :** ✅ Bug Critique Corrigé (2 endroits)

