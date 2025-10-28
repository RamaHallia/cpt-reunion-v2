# 🗑️ Suppression Automatique des Audios (24h)

## 🎯 Objectif

Mettre en place un système de **suppression automatique** des fichiers audio **24 heures** après leur création pour :
- ✅ **Optimiser le stockage** (réduire les coûts Supabase Storage)
- ✅ **Respecter la vie privée** (audios temporaires uniquement)
- ✅ **Informer l'utilisateur** (avertissement + temps restant)

---

## 🔧 Fonctionnalités Implémentées

### **1️⃣ Avertissement avant téléchargement**

**Fichier** : `src/components/MeetingDetail.tsx`

Lorsque l'utilisateur clique sur "Télécharger Audio", une **modal de confirmation** apparaît :

```typescript
const shouldDownload = confirm(
  '⚠️ IMPORTANT : Disponibilité limitée\n\n' +
  'L\'audio sera automatiquement supprimé 24 heures après sa création.\n\n' +
  'Téléchargez-le maintenant si vous souhaitez le conserver.\n\n' +
  'Voulez-vous continuer le téléchargement ?'
);
```

**Résultat** :
- ✅ User clique "OK" → Téléchargement démarre
- ❌ User clique "Annuler" → Aucune action

---

### **2️⃣ Affichage du temps restant**

**Fichier** : `src/components/MeetingDetail.tsx`

**Ajouts** :
```typescript
const [audioExpiresAt, setAudioExpiresAt] = useState<string | null>(null);
const [audioTimeRemaining, setAudioTimeRemaining] = useState<string>('');

// Timer mis à jour toutes les minutes
useEffect(() => {
  const updateTimeRemaining = () => {
    const now = new Date();
    const expiresAt = new Date(audioExpiresAt);
    const diff = expiresAt.getTime() - now.getTime();

    if (diff <= 0) {
      setAudioTimeRemaining('Expiré');
      setAudioAvailable(false);
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      setAudioTimeRemaining(`${hours}h ${minutes}min restantes`);
    } else if (minutes > 0) {
      setAudioTimeRemaining(`${minutes} minutes restantes`);
    } else {
      const seconds = Math.floor(diff / 1000);
      setAudioTimeRemaining(`${seconds} secondes restantes`);
    }
  };

  updateTimeRemaining();
  const interval = setInterval(updateTimeRemaining, 60000);
  return () => clearInterval(interval);
}, [audioExpiresAt]);
```

**Affichage** :
```tsx
{audioTimeRemaining && audioAvailable && (
  <div className="text-xs text-center">
    <span className={`font-semibold ${
      audioTimeRemaining.includes('Expiré') 
        ? 'text-red-600' 
        : audioTimeRemaining.includes('minutes') && !audioTimeRemaining.includes('h') 
        ? 'text-amber-600' 
        : 'text-blue-600'
    }`}>
      ⏰ {audioTimeRemaining}
    </span>
  </div>
)}
```

**Résultat** :
```
[Télécharger Audio]
⏰ 18h 32min restantes   (bleu)

[Télécharger Audio]
⏰ 45 minutes restantes   (ambre - alerte)

[Télécharger Audio]
⏰ Expiré                 (rouge)
```

---

### **3️⃣ Base de données : Colonne `audio_expires_at`**

**Fichier** : `supabase/migrations/20251027000003_audio_expiration.sql`

#### **A. Ajout de la colonne**
```sql
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS audio_expires_at timestamptz;

COMMENT ON COLUMN meetings.audio_expires_at IS 
  'Date d''expiration de l''audio (24h après création)';
```

#### **B. Trigger automatique**
```sql
CREATE OR REPLACE FUNCTION set_audio_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si un audio_url existe, définir l'expiration à 24h après la création
  IF NEW.audio_url IS NOT NULL AND NEW.audio_url != '' THEN
    NEW.audio_expires_at := NEW.created_at + interval '24 hours';
    RAISE NOTICE 'Audio expiration définie pour %: %', NEW.id, NEW.audio_expires_at;
  ELSE
    NEW.audio_expires_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_audio_expiration
  BEFORE INSERT OR UPDATE OF audio_url
  ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION set_audio_expiration();
```

**Fonctionnement** :
- ✅ **INSERT** avec `audio_url` → `audio_expires_at = created_at + 24h`
- ✅ **UPDATE** de `audio_url` → Recalcule `audio_expires_at`
- ✅ Pas d'`audio_url` → `audio_expires_at = NULL`

---

### **4️⃣ Fonction de nettoyage automatique**

**Fichier** : `supabase/migrations/20251027000003_audio_expiration.sql`

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_audios()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count integer := 0;
  expired_record RECORD;
BEGIN
  RAISE NOTICE '🧹 Démarrage du nettoyage des audios expirés...';

  -- Trouver tous les meetings avec audio expiré
  FOR expired_record IN
    SELECT id, audio_url, audio_expires_at, title
    FROM meetings
    WHERE audio_url IS NOT NULL
      AND audio_url != ''
      AND audio_expires_at IS NOT NULL
      AND audio_expires_at <= now()
  LOOP
    RAISE NOTICE '🗑️ Suppression audio expiré: % (réunion: %)', 
      expired_record.id, expired_record.title;
    
    -- Supprimer l'URL de la DB (le fichier reste dans le storage pour l'instant)
    UPDATE meetings
    SET 
      audio_url = NULL,
      audio_expires_at = NULL,
      updated_at = now()
    WHERE id = expired_record.id;
    
    expired_count := expired_count + 1;
  END LOOP;

  RAISE NOTICE '✅ Nettoyage terminé: % audio(s) supprimé(s)', expired_count;
END;
$$;
```

**Action** :
- ✅ Trouve tous les audios expirés (`audio_expires_at <= now()`)
- ✅ Met `audio_url = NULL` et `audio_expires_at = NULL`
- ✅ Log le nombre d'audios supprimés

**Note** : Les fichiers physiques dans Supabase Storage ne sont pas supprimés automatiquement. Vous devrez soit :
- Configurer une politique de lifecycle dans Supabase Storage
- Ou créer un script Edge Function pour supprimer les fichiers

---

### **5️⃣ CRON Job : Exécution toutes les heures**

**Fichier** : `supabase/migrations/20251027000003_audio_expiration.sql`

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Supprimer l'ancien job s'il existe (éviter erreur)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-audios');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Job cleanup-expired-audios n''existait pas, on continue...';
END $$;

-- Planifier le nettoyage automatique toutes les heures
SELECT cron.schedule(
  'cleanup-expired-audios',     -- nom du job
  '0 * * * *',                  -- CRON: toutes les heures à :00
  $$SELECT cleanup_expired_audios();$$ -- fonction à exécuter
);
```

**Résultat** :
- ✅ **00:00** → Nettoyage automatique
- ✅ **01:00** → Nettoyage automatique
- ✅ **02:00** → Nettoyage automatique
- ... (toutes les heures)

---

### **6️⃣ Backfill : Audios existants**

**Fichier** : `supabase/migrations/20251027000003_audio_expiration.sql`

```sql
UPDATE meetings
SET audio_expires_at = created_at + interval '24 hours'
WHERE audio_url IS NOT NULL
  AND audio_url != ''
  AND audio_expires_at IS NULL;
```

**Action** :
- ✅ Applique l'expiration à **tous les audios existants**
- ✅ Utilise `created_at` comme point de départ

---

## 📊 Flux Complet

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User enregistre une réunion                              │
│    - audio_url enregistré dans meetings                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Trigger SQL : set_audio_expiration()                     │
│    - audio_expires_at = created_at + 24h                    │
│    - Ex: Créé le 27/10 à 14:00 → Expire le 28/10 à 14:00   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. User consulte la réunion (MeetingDetail)                 │
│    - Affichage du temps restant (ex: "18h 32min restantes") │
│    - Mise à jour toutes les minutes                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. User clique "Télécharger Audio"                          │
│    - ⚠️ Avertissement : "Disponibilité 24h"                 │
│    - Confirmation → Téléchargement                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. CRON Job : Toutes les heures (00:00, 01:00, ...)        │
│    - cleanup_expired_audios()                                │
│    - Trouve audios où audio_expires_at <= now()             │
│    - Met audio_url = NULL                                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. User revient sur la réunion                              │
│    - "⏰ Expiré" (rouge)                                     │
│    - Bouton "Télécharger Audio" désactivé ou caché          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Déploiement

### **Étape 1 : Appliquer la migration SQL**

```bash
cd supabase
npx supabase db push
```

Ou via le SQL Editor de Supabase Dashboard :
1. Allez sur **SQL Editor**
2. Copiez le contenu de `20251027000003_audio_expiration.sql`
3. Exécutez

### **Étape 2 : Vérifier le CRON job**

```sql
-- Lister les CRON jobs
SELECT * FROM cron.job;

-- Devrait afficher :
-- jobid | jobname                  | schedule   | command
-- ------|--------------------------|------------|-------------------------------
-- 1     | cleanup-expired-audios   | 0 * * * *  | SELECT cleanup_expired_audios();
```

### **Étape 3 : Tester manuellement**

```sql
-- Exécuter le nettoyage manuellement
SELECT cleanup_expired_audios();

-- Vérifier les audios avec expiration
SELECT id, title, audio_url, audio_expires_at, created_at
FROM meetings
WHERE audio_url IS NOT NULL
ORDER BY audio_expires_at DESC
LIMIT 10;
```

### **Étape 4 : Build et redéployer le frontend**

```bash
npm run build
# Puis redéployer sur votre hébergement
```

---

## 🧪 Tests

### **Test 1 : Avertissement**
1. ✅ Créez une réunion avec audio
2. ✅ Cliquez sur **"Télécharger Audio"**
3. ✅ **RÉSULTAT** : Modal "⚠️ Disponibilité limitée" apparaît
4. ✅ Cliquez "Annuler" → Aucune action
5. ✅ Cliquez "OK" → Téléchargement démarre

### **Test 2 : Temps restant**
1. ✅ Créez une réunion avec audio
2. ✅ Consultez le détail de la réunion
3. ✅ **RÉSULTAT** : "⏰ 23h 59min restantes" (bleu)
4. ✅ Attendez 1 minute → "⏰ 23h 58min restantes"
5. ✅ Attendez 23h → "⏰ 58 minutes restantes" (ambre)

### **Test 3 : Expiration dans la DB**
```sql
-- Créer une réunion avec audio
INSERT INTO meetings (user_id, title, audio_url, created_at)
VALUES ('USER_ID', 'Test Audio', 'https://...', now());

-- Vérifier l'expiration
SELECT audio_expires_at FROM meetings WHERE title = 'Test Audio';
-- Devrait être : now() + 24 hours
```

### **Test 4 : Nettoyage manuel**
```sql
-- Forcer une expiration immédiate (pour test)
UPDATE meetings
SET audio_expires_at = now() - interval '1 hour'
WHERE title = 'Test Audio';

-- Exécuter le nettoyage
SELECT cleanup_expired_audios();

-- Vérifier que audio_url est NULL
SELECT audio_url FROM meetings WHERE title = 'Test Audio';
-- Devrait être : NULL
```

### **Test 5 : CRON automatique**
1. ✅ Créez une réunion avec audio
2. ✅ Forcez l'expiration : `UPDATE meetings SET audio_expires_at = now() - interval '1 hour'`
3. ✅ Attendez la prochaine heure (ex: 15:00)
4. ✅ **RÉSULTAT** : CRON exécute `cleanup_expired_audios()` automatiquement
5. ✅ Vérifiez : `audio_url` devrait être `NULL`

---

## 🎨 Design de l'Interface

### **Bouton avec temps restant**

```
┌──────────────────────────────────┐
│   [Download] Télécharger Audio   │ (bleu)
│   ⏰ 18h 32min restantes          │ (bleu)
└──────────────────────────────────┘

┌──────────────────────────────────┐
│   [Download] Télécharger Audio   │ (bleu)
│   ⏰ 45 minutes restantes         │ (ambre - alerte)
└──────────────────────────────────┘

┌──────────────────────────────────┐
│   [Clock] Revérifier l'audio     │ (ambre)
│   ⏰ Expiré                       │ (rouge)
└──────────────────────────────────┘
```

### **Modal d'avertissement**

```
┌─────────────────────────────────────────┐
│  ⚠️ IMPORTANT : Disponibilité limitée   │
│                                          │
│  L'audio sera automatiquement supprimé  │
│  24 heures après sa création.           │
│                                          │
│  Téléchargez-le maintenant si vous      │
│  souhaitez le conserver.                │
│                                          │
│  Voulez-vous continuer le téléchargement?│
│                                          │
│         [ Annuler ]    [ OK ]            │
└─────────────────────────────────────────┘
```

---

## 📋 Fichiers Modifiés

| Fichier | Changement | Lignes |
|---------|-----------|--------|
| `src/components/MeetingDetail.tsx` | Avertissement + Temps restant | +70 |
| `supabase/migrations/20251027000003_audio_expiration.sql` | Colonne + Trigger + CRON | +150 |
| `AUDIO_AUTO_DELETION_24H.md` | Documentation | +600 |

---

## ⚙️ Configuration Avancée

### **Modifier la durée d'expiration**

Pour changer de 24h à une autre durée (ex: 48h) :

```sql
-- Dans set_audio_expiration()
NEW.audio_expires_at := NEW.created_at + interval '48 hours';

-- Backfill
UPDATE meetings
SET audio_expires_at = created_at + interval '48 hours'
WHERE audio_url IS NOT NULL AND audio_expires_at IS NOT NULL;
```

### **Supprimer physiquement les fichiers du storage**

**Option A** : Politique de lifecycle Supabase
- Dashboard → Storage → Bucket → Lifecycle policies
- Définir une règle : "Delete files older than 24 hours"

**Option B** : Edge Function dédiée
```typescript
// supabase/functions/cleanup-storage-audios/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // Récupérer les audio_url expirés qui viennent d'être NULL
  // Extraire le path du fichier dans le storage
  // Supprimer avec supabase.storage.from('bucket').remove([path])
  
  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

Puis l'appeler dans `cleanup_expired_audios()` via une requête HTTP.

---

## 🔒 Sécurité

### **RLS (Row Level Security)**

La fonction `cleanup_expired_audios()` utilise `SECURITY DEFINER` pour s'exécuter avec les privilèges du propriétaire de la fonction (bypass RLS).

**Vérification** :
```sql
-- S'assurer que seul le CRON peut appeler cette fonction
REVOKE EXECUTE ON FUNCTION cleanup_expired_audios() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_audios() TO postgres;
```

---

## 📊 Monitoring

### **Logs du CRON**

```sql
-- Voir les logs du CRON (si activé)
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-expired-audios')
ORDER BY start_time DESC
LIMIT 10;
```

### **Statistiques**

```sql
-- Nombre d'audios actifs
SELECT COUNT(*) FROM meetings WHERE audio_url IS NOT NULL;

-- Nombre d'audios expirés (pas encore nettoyés)
SELECT COUNT(*) FROM meetings 
WHERE audio_url IS NOT NULL 
  AND audio_expires_at <= now();

-- Prochains audios à expirer
SELECT title, audio_expires_at, 
       audio_expires_at - now() AS time_remaining
FROM meetings
WHERE audio_url IS NOT NULL
ORDER BY audio_expires_at ASC
LIMIT 10;
```

---

## ✅ Résumé

### **Fonctionnalités**
- ✅ **Avertissement** avant téléchargement
- ✅ **Temps restant** affiché en temps réel
- ✅ **Expiration automatique** après 24h
- ✅ **Nettoyage CRON** toutes les heures
- ✅ **Backfill** pour audios existants

### **Avantages**
- 💰 **Réduction des coûts** de storage
- 🔒 **Confidentialité** : audios temporaires
- 👤 **Transparence** : user informé
- 🤖 **Automatisation** : aucune action manuelle

---

## 🎉 **Système d'Expiration des Audios Opérationnel !**

**Prochaines étapes** :
1. ✅ Appliquer la migration SQL
2. ✅ Vérifier le CRON job
3. ✅ Build et redéployer le frontend
4. ✅ Tester avec une réunion test
5. 🔜 (Optionnel) Configurer la suppression physique des fichiers storage

