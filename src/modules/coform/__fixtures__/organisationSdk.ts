import Cocolight, { type EntityTypes } from "@communecter/cocolight-api-client";

/**
 * Une VRAIE organisation SDK, lue par `api.organization` sur un transport intercepté — pour tester
 * ce qui consomme une entité sans remplacer l'entité par un objet nu (qui effacerait ses règles).
 *
 * Remplacer `callEndpoint` court-circuite aussi la normalisation de lecture du SDK (`_transformData`,
 * qui rend les vignettes absolues) : on la rejoue sur les données fournies.
 */
export async function organisationSdk(data: Record<string, unknown> & { id: string }): Promise<EntityTypes> {
  const client = new Cocolight.ApiClient({ baseURL: "http://localhost" } as never);
  const normaliser = (client as unknown as { _transformData: (d: unknown) => unknown })._transformData.bind(client);
  client.callEndpoint = (async (constant: string) =>
    constant === "GET_ELEMENTS_ABOUT" ? { result: true, data: normaliser(data) } : { result: true }) as never;
  return (await new Cocolight.Api(null, client).organization({ id: data.id })) as EntityTypes;
}
