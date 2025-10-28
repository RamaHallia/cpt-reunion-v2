# 🔧 FIX : Erreur "Auth session missing" - Test SMTP

## 🐛 **Les Erreurs Rencontrées**

### **Erreur 1 : "Unauthorized"**
```
❌ Error: Unauthorized
    at Object.handler (index.ts:32:13)
```

### **Erreur 2 : "Auth session missing"**
```
❌ Auth error: AuthSessionMissingError: Auth session missing!
    at https://esm.sh/@supabase/gotrue-js@2.76.1/...
```

---

## 🔍 **Cause des Erreurs**

### **Problème 1 : Permissions RPC**
- ❌ Utilisation de `ANON_KEY` pour appeler `decrypt_smtp_password()`
- ❌ RPC nécessite `SERVICE_ROLE_KEY`

### **Problème 2 : Authentification dans Edge Function**
- ❌ Appel de `.getUser()` sans passer le token en paramètre
- ❌ Dans une Edge Function, il n'y a **pas de session persistée**
- ❌ Il faut **passer le token JWT explicitement**

---

## ✅ **Solutions Appliquées**

### **1️⃣ Utiliser SERVICE_ROLE_KEY pour RPC**

```typescript
// ✅ Client admin pour RPC
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ✅ Utiliser supabaseAdmin pour déchiffrer
const { data: settings } = await supabaseAdmin
  .from('user_settings')
  .select('smtp_password_encrypted')...

const { data: decrypted } = await supabaseAdmin
  .rpc('decrypt_smtp_password', ...)
```

---

### **2️⃣ Passer le token à getUser()**

**Avant** ❌ :
```typescript
const supabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { global: { headers: { Authorization: authHeader } } }
);

// ❌ getUser() sans paramètre cherche une session locale
const { data: { user } } = await supabaseClient.auth.getUser();
// Résultat : AuthSessionMissingError
```

**Après** ✅ :
```typescript
// Extraire le token du header
const token = authHeader.replace('Bearer ', '');

const supabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { 
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }  // ✅ Pas de session locale
  }
);

// ✅ Passer le token explicitement
const { data: { user } } = await supabaseClient.auth.getUser(token);
```

---

## 📊 **Différence : Client vs Edge Function**

| Aspect | Client (Browser) | Edge Function (Deno) |
|--------|------------------|----------------------|
| **Session** | ✅ Persistée (localStorage) | ❌ Aucune persistence |
| **getUser()** | `await supabase.auth.getUser()` | `await supabase.auth.getUser(token)` |
| **Token** | Automatique | ✅ Doit être passé explicitement |
| **RLS** | Appliqué automatiquement | Dépend de la clé utilisée |

---

## 🔧 **Code Final Complet**

**Fichier** : `supabase/functions/test-smtp-connection/index.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1️⃣ Vérifier le header Authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // 2️⃣ Extraire le token
    const token = authHeader.replace('Bearer ', '');
    
    // 3️⃣ Créer client Supabase (ANON_KEY)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      }
    );

    // 4️⃣ Vérifier le token (PASSER LE TOKEN EN PARAMÈTRE)
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Non authentifié. Veuillez vous reconnecter.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // 5️⃣ Créer client admin (SERVICE_ROLE_KEY)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 6️⃣ Parse request body
    const { host, port, user: smtpUser, password, secure, userId, useExistingPassword } = await req.json();

    // Vérifier user_id
    if (user.id !== userId) {
      throw new Error('Unauthorized');
    }

    let finalPassword = password;

    // 7️⃣ Récupérer mot de passe existant si nécessaire
    if (useExistingPassword && !password) {
      const { data: settings } = await supabaseAdmin
        .from('user_settings')
        .select('smtp_password_encrypted')
        .eq('user_id', userId)
        .maybeSingle();

      if (!settings?.smtp_password_encrypted) {
        throw new Error('Mot de passe SMTP non trouvé');
      }

      // Déchiffrer avec supabaseAdmin
      const { data: decryptedPassword, error: decryptError } = await supabaseAdmin
        .rpc('decrypt_smtp_password', {
          encrypted_password: settings.smtp_password_encrypted,
          user_id: userId
        });

      if (decryptError || !decryptedPassword) {
        throw new Error('Impossible de déchiffrer le mot de passe');
      }

      finalPassword = decryptedPassword;
    }

    if (!finalPassword) {
      throw new Error('Mot de passe requis');
    }

    // 8️⃣ Tester la connexion SMTP
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

    try {
      await client.connect();
      await client.close();

      return new Response(
        JSON.stringify({ success: true, message: 'Connexion SMTP réussie' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } catch (smtpError: any) {
      let errorMessage = 'Connexion échouée';
      
      if (smtpError.message?.includes('authentication failed') || 
          smtpError.message?.includes('535')) {
        errorMessage = 'Authentification échouée. Vérifiez votre email et mot de passe.';
      } else if (smtpError.message?.includes('ECONNREFUSED')) {
        errorMessage = 'Impossible de contacter le serveur. Vérifiez l\'adresse et le port.';
      } else if (smtpError.message?.includes('TLS')) {
        errorMessage = 'Erreur de sécurité. Vérifiez le port (587 pour TLS, 465 pour SSL).';
      } else {
        errorMessage = smtpError.message || 'Erreur inconnue';
      }

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
  } catch (error: any) {
    console.error('❌ Erreur:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur serveur' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
```

---

## 🚀 **Déploiement**

### **Via Supabase Dashboard** (Recommandé)

1. ✅ https://supabase.com/dashboard → Votre projet
2. ✅ **Edge Functions** → `test-smtp-connection`
3. ✅ Cliquez **"Edit"** ou créez la fonction
4. ✅ Copiez tout le code ci-dessus
5. ✅ **Deploy**

### **Via CLI**

```bash
cd "C:\Users\tech\OneDrive\Desktop\Nouveau dossier\project"
npx supabase functions deploy test-smtp-connection
```

---

## 🧪 **Test Final**

1. ✅ Ouvrez **Settings** → **SMTP**
2. ✅ Remplissez :
   - Serveur : `smtp.gmail.com`
   - Port : `587`
   - Email : `votre@gmail.com`
   - Mot de passe : **Mot de passe d'application Gmail**
3. ✅ Cliquez **"Tester la connexion SMTP"**
4. ✅ **Résultat attendu** : 
   ```
   ✅ Connexion réussie ! Les identifiants sont corrects.
   Vous pouvez maintenant enregistrer vos paramètres.
   ```

---

## 📊 **Logs Attendus**

Dans **Dashboard** → **Edge Functions** → `test-smtp-connection` → **Logs** :

```
📋 Auth header présent: true
👤 User récupéré: uuid-abc-123 Error: undefined
🔌 Test de connexion SMTP: { host: 'smtp.gmail.com', port: 587, ... }
🔐 Récupération du mot de passe existant...
✅ Mot de passe déchiffré
📧 Tentative de connexion au serveur SMTP...
✅ Connexion SMTP réussie
✅ Déconnexion SMTP
```

---

## ✅ **Résumé des Corrections**

| Problème | Solution |
|----------|----------|
| ❌ "Unauthorized" | ✅ Utiliser `SERVICE_ROLE_KEY` pour RPC |
| ❌ "Auth session missing" | ✅ Passer le token à `.getUser(token)` |
| ❌ Pas de persistence session | ✅ `auth: { persistSession: false }` |

---

## 📁 **Fichiers Modifiés**

- ✅ `supabase/functions/test-smtp-connection/index.ts` (Correction auth)
- ✅ `FIX_SMTP_TEST_AUTH.md` (Ce document)

---

**🎉 Erreurs corrigées ! Redéployez et testez ! 🚀**

**Note** : Pour Gmail, n'oubliez pas de créer un **Mot de passe d'application** dans votre compte Google (Sécurité → Validation en 2 étapes → Mots de passe d'application).

