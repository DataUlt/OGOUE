import crypto from "crypto";

/**
 * Secret de signature des jetons agents.
 *
 * Il etait lu partout sous la forme `process.env.JWT_SECRET ||
 * "default_secret"`. Cette valeur de repli est publique — elle est dans
 * le code, donc sur GitHub. Si la variable manquait sur Render, n'importe
 * qui pouvait fabriquer un jeton valide :
 *
 *   jwt.sign({ role: "agent", organizationId: "<n'importe lequel>" },
 *            "default_secret")
 *
 * et lire ou modifier les ventes, les depenses et les agents de
 * n'importe quelle entreprise. C'etait la faille la plus grave du
 * projet, et elle ne tenait qu'a une variable d'environnement oubliee.
 *
 * On ne se rabat donc plus sur une constante connue. A defaut de secret
 * configure, on en tire un au hasard au demarrage : les jetons restent
 * infalsifiables, et le seul effet visible est que les agents doivent se
 * reconnecter apres chaque redemarrage — un desagrement, pas une breche.
 * Arreter le serveur serait l'autre facon d'echouer proprement, mais
 * elle coupe le service a des clients qui n'y sont pour rien.
 */
function resoudreSecret() {
  const fourni = process.env.JWT_SECRET;

  // 32 caracteres : en deca, un secret se casse hors ligne a partir d'un
  // seul jeton intercepte.
  if (fourni && fourni.length >= 32 && fourni !== "default_secret") {
    return fourni;
  }

  if (fourni) {
    console.error(
      "🔴 JWT_SECRET trop court ou trop connu (" + fourni.length + " caracteres). " +
      "Il est IGNORE. Definissez-en un d'au moins 32 caracteres sur Render."
    );
  } else {
    console.error(
      "🔴 JWT_SECRET absent. Un secret aleatoire est utilise pour cette " +
      "instance : les agents devront se reconnecter a chaque redemarrage. " +
      "Definissez JWT_SECRET sur Render pour y remedier."
    );
  }

  return crypto.randomBytes(48).toString("hex");
}

export const JWT_SECRET = resoudreSecret();

/**
 * Chaine aleatoire sure, pour un secret qu'un humain devra recopier.
 *
 * Math.random() n'est pas un generateur cryptographique : son etat
 * interne se reconstitue a partir de quelques tirages, ce qui permet de
 * predire les suivants. Acceptable pour melanger un tableau, pas pour
 * fabriquer un identifiant de connexion.
 *
 * L'alphabet exclut I, O, 0 et 1, qui se confondent a la lecture : un
 * code se dicte au telephone ou se recopie depuis un papier.
 */
const ALPHABET_LISIBLE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function codeAleatoire(longueur) {
  let code = "";
  for (let i = 0; i < longueur; i++) {
    code += ALPHABET_LISIBLE[crypto.randomInt(ALPHABET_LISIBLE.length)];
  }
  return code;
}
