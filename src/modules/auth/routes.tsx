import type { RouteObject } from "react-router";
import type { ModuleRouteFactory } from "@/lib/modules";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RecoverPasswordPage from "./pages/RecoverPasswordPage";
import ActivateAccountPage from "./pages/ActivateAccountPage";
import ValidateInvitationPage from "./pages/ValidateInvitationPage";
import AcceptInvitationPage from "./pages/AcceptInvitationPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import JoinByLinkPage from "./pages/JoinByLinkPage";

/**
 * Routes du module auth, injectées dans le router via la découverte de modules
 * (`src/lib/modules.ts`). Fournit les pages auth pour tous les sites — plus
 * besoin de les redéclarer dans chaque config JSON.
 *
 * - /login
 * - /register
 * - /recover-password
 * - /recover/:user/:code                 (lien de récupération de mot de passe — mode Node SEULEMENT)
 * - /validate/:user/:validationKey        (liens du backend Node)
 * - /co2/person/activate/user/:user/validationKey/:validationKey/*  (liens LEGACY)
 * - /co2/link/connect/ref/:ref            (lien d'invitation partageable, cf. docs/25)
 *
 * Les deux formes de liens de validation sont servies pour que les e-mails DÉJÀ
 * ENVOYÉS restent valides quand le domaine d'un costum pointe sur site-json
 * (cf. cocolight-backend/docs/23-EMAILS-LIENS-ACTIVATION.md). Le splat de la
 * route legacy absorbe les suffixes Yii `/costum/true`, `/redirect/…`,
 * `/toredirect/…`. La route connect/ref sert les liens partageables DÉJÀ diffusés
 * (costum.invitationLink, 341 costums) sur les domaines pointant sur site-json.
 */
export const routes: ModuleRouteFactory = (_queryClient, config): RouteObject[] => [
  { path: "login", element: <LoginPage /> },
  { path: "register", element: <RegisterPage /> },
  { path: "recover-password", element: <RecoverPasswordPage /> },
  { path: "validate/:user/:validationKey?", element: <ActivateAccountPage /> },
  // Page de saisie d'un nouveau mot de passe via code — flux Node UNIQUEMENT (opt-in
  // `config.auth.recover.mode = "node"`). En défaut legacy, le backend n'émet aucun lien
  // /recover/:user/:code (il régénère+envoie le mdp) : la route n'existe donc pas, pour ne pas
  // exposer une page morte contre le backend legacy. Précédent : profil/routes.tsx gate `profiles`.
  ...(config?.auth?.recover?.mode === "node"
    ? [{ path: "recover/:user/:code", element: <ResetPasswordPage /> }]
    : []),
  {
    path: "co2/person/activate/user/:user/validationKey/:validationKey/*",
    element: <ActivateAccountPage />,
  },
  {
    path: "co2/person/activate/user/:user/validationKey/:validationKey",
    element: <ActivateAccountPage />,
  },
  // Liens d'INVITATION (≠ activation) : `validateinvitation` → passerelle vers l'inscription (l'invité
  // finalise son compte pending). Splat = suffixes Yii `/invitation/1`, `/costum/true`, `/redirect/…`.
  {
    path: "co2/person/validateinvitation/user/:user/validationKey/:validationKey/*",
    element: <ValidateInvitationPage />,
  },
  {
    path: "co2/person/validateinvitation/user/:user/validationKey/:validationKey",
    element: <ValidateInvitationPage />,
  },
  // Réponse Accepter/Refuser d'une invitation par e-mail (≠ passerelle validateinvitation) :
  // l'action n'est déclenchée qu'au clic.
  //
  // ⚠️ `answer` N'EST PAS un segment de position fixe. `invitation.php` construit `$urlActions`
  // AVANT d'y coller la réponse : il y insère d'abord `/costum/true` (l.23) ou
  // `/redirect/<url pointée>` (l.20), PUIS concatène `"/answer/true"` (l.115) ou `"/answer/false"`
  // (l.132). Un costum à DOMAINE PROPRE — c'est-à-dire précisément un site servi par site-json —
  // émet donc `…/targetId/<id>/costum/true/answer/true`, avec les suffixes AVANT la réponse.
  // Une route `…/targetId/:targetId/answer/:answer/*` ne matche pas cette forme : mesuré, elle
  // retombait sur la page d'accueil du site, sans erreur — donc silencieusement.
  // D'où le SPLAT unique : tout ce qui suit `targetId` est absorbé, et la page extrait `answer`
  // du splat quel que soit l'ordre des segments (cf. `lireReponse` dans AcceptInvitationPage).
  {
    path: "co2/link/validateinvitationbymail/userId/:userId/targetType/:targetType/targetId/:targetId/*",
    element: <AcceptInvitationPage />,
  },
  { path: "co2/link/connect/ref/:ref", element: <JoinByLinkPage /> },
];
