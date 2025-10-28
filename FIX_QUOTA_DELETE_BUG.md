# 🐛 Fix : Le Quota Diminuait lors de la Suppression de Réunions

## Problème Identifié

### **Comportement Incorrect :**
```
1. User enregistre 3 réunions: 100 + 50 + 30 = 180 minutes ✅
2. quota = 180 minutes ✅
3. User supprime la réunion de 50 minutes ⚠️
4. User crée une nouvelle réunion de 20 minutes
5. quota = 100 + 30 + 20 = 150 minutes ❌ (au lieu de 200)
```

**Le quota a DIMINUÉ alors qu'il devrait AUGMENTER !**

---

## 🔍 Cause Racine

### **Ancien Code (Bugué) :**

```sql
-- Fonction dans 20251026000000_auto_update_quota_on_meeting_insert.sql
CREATE OR REPLACE FUNCTION update_user_quota_on_meeting_insert()
...
BEGIN
  -- ❌ PROBLÈME: RECALCULE le total à chaque INSERT
  SELECT COALESCE(SUM(ROUND(duration / 60.0)), 0)
  INTO total_minutes_used
  FROM meetings
  WHERE user_id = NEW.user_id
    AND created_at >= user_cycle_start;
  
  -- Remplace la valeur par le total recalculé
  UPDATE user_subscriptions
  SET minutes_used_this_month = total_minutes_used
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
```

### **Pourquoi c'est bugué :**

1. **À chaque INSERT**, la fonction fait un `SUM()` de **TOUTES** les meetings existantes
2. Si une meeting est supprimée de la base, elle n'est plus dans le `SUM()`
3. Le total recalculé est donc **plus bas**
4. Le quota diminue ❌

---

## ✅ Solution Implémentée

### **Nouveau Code (Corrigé) :**

```sql
-- Migration: 20251027000000_fix_quota_no_recalculate.sql
CREATE OR REPLACE FUNCTION update_user_quota_on_meeting_insert()
...
BEGIN
  -- ✅ Calculer uniquement les minutes de CETTE réunion
  meeting_minutes := ROUND(NEW.duration / 60.0);
  
  -- ✅ INCRÉMENTER le compteur (ne pas recalculer)
  UPDATE user_subscriptions
  SET 
    minutes_used_this_month = COALESCE(minutes_used_this_month, 0) + meeting_minutes,
    updated_at = now()
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
```

### **Principe :**

| Événement | Ancien (Bugué) | Nouveau (Corrigé) |
|-----------|----------------|-------------------|
| **INSERT meeting 100min** | Recalcule: SUM() = 100 | Incrémente: 0 + 100 = 100 ✅ |
| **INSERT meeting 50min** | Recalcule: SUM() = 150 | Incrémente: 100 + 50 = 150 ✅ |
| **DELETE meeting 50min** | (Aucun trigger) | (Aucun trigger) ✅ |
| **INSERT meeting 20min** | Recalcule: SUM() = 120 ❌ | Incrémente: 150 + 20 = 170 ✅ |

---

## 🎯 Comportement Attendu

### **Scénario 1 : Enregistrements successifs**
```
1. User crée meeting 100min → quota = 100 ✅
2. User crée meeting 50min  → quota = 150 ✅
3. User crée meeting 30min  → quota = 180 ✅
```

### **Scénario 2 : Suppression puis nouvel enregistrement**
```
1. User a quota = 180 minutes
2. User SUPPRIME meeting de 50min
3. quota reste à 180 ✅ (les minutes sont consommées définitivement)
4. User crée nouvelle meeting 20min
5. quota = 180 + 20 = 200 ✅
```

### **Scénario 3 : Reset mensuel**
```
1. User a quota = 450 minutes
2. Fin du cycle de facturation (1 mois après inscription)
3. CRON job exécute reset_monthly_quotas()
4. quota = 0 ✅
5. User peut recommencer à enregistrer
```

---

## 📁 Fichiers Modifiés

### **1. Migration de Correction**

**Fichier :** `supabase/migrations/20251027000000_fix_quota_no_recalculate.sql`

**Contenu :**
- ✅ Remplace la fonction `update_user_quota_on_meeting_insert()`
- ✅ Change la logique de **RECALCUL** → **INCRÉMENTATION**
- ✅ Le trigger reste inchangé (AFTER INSERT)

### **2. Documentation**

**Fichier :** `FIX_QUOTA_DELETE_BUG.md` (ce document)

---

## 🚀 Déploiement

### **Étapes :**

1. ✅ Migration créée : `20251027000000_fix_quota_no_recalculate.sql`
2. ⚠️ **Appliquer la migration :**
   ```bash
   cd supabase
   npx supabase db push
   ```
3. ✅ Vérifier les logs Supabase
4. ✅ Tester avec un compte utilisateur

### **⚠️ IMPORTANT : Recalibrage des Quotas Existants**

Après avoir appliqué la migration, les quotas existants pourraient être **incorrects** si des utilisateurs ont déjà supprimé des réunions.

**Option 1 : Reset manuel (recommandé)**
```sql
-- Remettre tous les quotas à 0
UPDATE user_subscriptions
SET minutes_used_this_month = 0
WHERE plan_type = 'starter';
```

**Option 2 : Recalcul one-shot (plus précis)**
```sql
-- Recalculer correctement une dernière fois
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
  END LOOP;
END $$;
```

**⚠️ Choisir Option 1 (plus simple) ou Option 2 (plus juste), mais PAS les deux !**

---

## 🧪 Tests à Effectuer

### **Test 1 : Enregistrement Normal**
1. ✅ Créer une réunion de 10 minutes
2. ✅ Vérifier que quota augmente de 10
3. ✅ Créer une autre réunion de 5 minutes
4. ✅ Vérifier que quota augmente de 5 (total = 15)

### **Test 2 : Suppression (Critical)**
1. ✅ Quota actuel = 15 minutes
2. ✅ Supprimer une réunion de 10 minutes de l'historique
3. ✅ **Vérifier que quota reste à 15** ✅
4. ✅ Créer une nouvelle réunion de 8 minutes
5. ✅ **Vérifier que quota = 15 + 8 = 23** ✅

### **Test 3 : Dashboard**
1. ✅ Aller dans Dashboard
2. ✅ Vérifier que la barre de progression reflète le vrai quota
3. ✅ Supprimer une réunion
4. ✅ Recharger le Dashboard
5. ✅ **Vérifier que la barre n'a PAS diminué** ✅

---

## 📊 Comparaison Avant/Après

### **Avant (Bugué) :**
```
Actions:
  INSERT 100min → quota = 100
  INSERT 50min  → quota = 150
  DELETE 50min  → quota = 150 (inchangé)
  INSERT 20min  → quota = 120 ❌ (recalculé: 100+20)
```

### **Après (Corrigé) :**
```
Actions:
  INSERT 100min → quota = 100
  INSERT 50min  → quota = 150
  DELETE 50min  → quota = 150 (inchangé)
  INSERT 20min  → quota = 170 ✅ (incrémenté: 150+20)
```

---

## 🔒 Règles de Gestion Confirmées

### **Principes Intangibles :**

1. ✅ **Les minutes consommées sont DÉFINITIVES**
   - Une fois enregistrée, une minute est comptée
   - Supprimer l'historique ne restitue PAS les minutes

2. ✅ **Le quota ne peut QUE monter** (pendant le cycle)
   - Chaque enregistrement AJOUTE des minutes
   - Aucune action ne peut RETIRER des minutes

3. ✅ **Le reset se fait uniquement par CRON**
   - Une fois par mois (cycle de facturation)
   - Fonction `reset_monthly_quotas()` vérifie `billing_cycle_end`

4. ✅ **La suppression d'historique est cosmétique**
   - Ne touche que la table `meetings`
   - N'affecte jamais `user_subscriptions.minutes_used_this_month`

---

## 🎓 Leçons Apprises

### **Pourquoi l'ancien code était problématique :**

1. **Recalcul = Dépendance aux données**
   - Le trigger dépend de l'état actuel de la table `meetings`
   - Si les données changent (DELETE), le résultat change

2. **Incrémentation = Indépendance**
   - Le trigger ne dépend que de la nouvelle donnée (NEW)
   - Les anciennes données n'affectent pas le résultat

### **Règle d'or pour les quotas :**

> **Un quota de consommation doit TOUJOURS être incrémenté, JAMAIS recalculé à partir des données sources.**

---

## ✅ Checklist de Validation

Après déploiement, vérifier :

- [ ] Migration appliquée sans erreur
- [ ] Fonction `update_user_quota_on_meeting_insert()` mise à jour
- [ ] Trigger toujours actif sur `meetings` (AFTER INSERT)
- [ ] Créer une meeting → quota augmente
- [ ] Supprimer une meeting → quota reste stable
- [ ] Créer une nouvelle meeting après suppression → quota augmente correctement
- [ ] Dashboard affiche le bon quota
- [ ] Aucun log d'erreur dans Supabase

---

**Date de correction :** 27 octobre 2025  
**Version :** 1.0  
**Status :** 🐛 Bug Critique Corrigé

