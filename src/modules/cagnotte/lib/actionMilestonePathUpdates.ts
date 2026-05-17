import type { Api, DeleteElementData, UpdatePathValueData } from "@communecter/cocolight-api-client";
import i18n from "@/i18n";
import { normalizeUpdatePathValuePayload } from "@/lib/updatePathValue";

const tCagnotte = (key: string): string =>
  String(i18n.t(key, { ns: "modules/cagnotte" }));

type UpdateSource = Api | null;
type UpdateSetType = string | Array<{ path: string; type: string }>;
type UpdateValue = UpdatePathValueData["value"];

function requireSource(source: UpdateSource): Api {
  if (!source) {
    throw new Error(tCagnotte("milestone.errors.apiClientUnavailable"));
  }
  return source;
}

type UpdateAnswerMilestoneParams = {
  kind: "milestone";
  source: UpdateSource;
  answerId: string;
  index: string;
  field: string;
  value: UpdateValue;
  setType?: UpdateSetType;
};

type UpdateProjectActionParams = {
  kind: "action";
  source: UpdateSource;
  projectId: string;
  index: string;
  field: string;
  value: UpdateValue;
  setType?: UpdateSetType;
};

export async function updateActionOrMilestoneField(
  params: UpdateAnswerMilestoneParams | UpdateProjectActionParams
) {
  const api = requireSource(params.source);
  const safeSetType =
    typeof params.setType === "string"
      ? params.setType
      : Array.isArray(params.setType) && params.setType.length > 0
        ? params.setType
        : undefined;

  if (params.kind === "action") {
    return api.endpointApi.updatePathValue(
      normalizeUpdatePathValuePayload({
        id: params.index,
        collection: "actions",
        path: params.field,
        value: params.value,
        ...(safeSetType ? { setType: safeSetType } : {}),
      })
    );
  }

  if (params.kind === "milestone") {
    return api.endpointApi.updatePathValue(
      normalizeUpdatePathValuePayload({
        id: params.answerId,
        collection: "answers",
        path: `answers.aapStep1.depense.${params.index}.${params.field}`,
        value: params.value,
        ...(safeSetType ? { setType: safeSetType } : {}),
      })
    );
  }

  throw new Error("updateActionOrMilestoneField: kind non supporte");
}

export async function updateProjectActionFields(params: {
  source: UpdateSource;
  projectId: string;
  index: string;
  fields: Record<string, UpdateValue>;
  setType?: UpdateSetType;
}) {
  const entries = Object.entries(params.fields);
  const isDateField = (field: string) => field === "startDate" || field === "endDate";

  const dateEntries = entries.filter(([field]) => isDateField(field));
  const otherEntries = entries.filter(([field]) => !isDateField(field));

  // Champs non-date: jamais de setType
  for (const [field, value] of otherEntries) {
    await updateActionOrMilestoneField({
      kind: "action",
      source: params.source,
      projectId: params.projectId,
      index: params.index,
      field,
      value,
    });
  }

  // Champs date: envoyer startDate/endDate ensemble (parallel) avec un setType date uniquement
  if (dateEntries.length > 0) {
    const dateSetType = Array.isArray(params.setType)
      ? params.setType.filter((item) => isDateField(item.path))
      : [];
    const safeDateSetType = dateSetType.length > 0 ? dateSetType : undefined;

    await Promise.all(
      dateEntries.map(([field, value]) =>
        updateActionOrMilestoneField({
          kind: "action",
          source: params.source,
          projectId: params.projectId,
          index: params.index,
          field,
          value,
          setType: typeof value === "string" ? "isoDate" : safeDateSetType,
        })
      )
    );
  }
}

export async function appendProjectMilestone(params: {
  source: UpdateSource;
  projectId: string;
  milestone: {
    milestoneId: string;
    name: string;
    description: string;
    status: 'open' | 'done';
  };
}) {
  const api = requireSource(params.source);
  return api.endpointApi.updatePathValue(
    normalizeUpdatePathValuePayload({
      id: params.projectId,
      collection: 'projects',
      path: 'oceco.milestones',
      value: params.milestone,
      arrayForm: true,
    })
  );
}

export async function appendAnswerDepense(params: {
  source: UpdateSource;
  answerId: string;
  depense: {
    poste: string;
    price: number;
    date: string;
    user: string;
    milestone: string;
    financer?: unknown[];
  };
}) {
  const api = requireSource(params.source);
  return api.endpointApi.updatePathValue(
    normalizeUpdatePathValuePayload({
      id: params.answerId,
      collection: 'answers',
      path: 'answers.aapStep1.depense',
      value: params.depense,
      arrayForm: true,
      setType: [
        {
          path: 'date',
          type: 'isoDate',
        },
        {
          path: 'price',
          type: 'int',
        },
      ],
    })
  );
}

export const deleteActionById = async (params: {
  source: UpdateSource;
  actionId: string;
}) => {
  if (!params.source) {
    throw new Error(tCagnotte("milestone.errors.deleteActionUnavailable"));
  }
  const payload: DeleteElementData = {
    reason: "delete action via cagnotte",
    pathParams: { type: "actions", id: params.actionId },
  };
  return params.source.endpointApi.deleteElement(payload);
};

export async function updateProjectMilestoneFields(params: {
  source: UpdateSource;
  projectId: string;
  index: number;
  fields: Record<string, UpdateValue>;
}) {
  const api = requireSource(params.source);
  const entries = Object.entries(params.fields);
  for (const [field, value] of entries) {
    await api.endpointApi.updatePathValue(
      normalizeUpdatePathValuePayload({
        id: params.projectId,
        collection: "projects",
        path: `oceco.milestones.${params.index}.${field}`,
        value,
      })
    );
  }
}

export async function updateAnswerDepenseFields(params: {
  source: UpdateSource;
  answerId: string;
  index: number;
  fields: Record<string, UpdateValue>;
  setType?: UpdateSetType;
}) {
  const api = requireSource(params.source);
  const entries = Object.entries(params.fields);
  for (const [field, value] of entries) {
    await api.endpointApi.updatePathValue(
      normalizeUpdatePathValuePayload({
        id: params.answerId,
        collection: "answers",
        path: `answers.aapStep1.depense.${params.index}.${field}`,
        value,
        ...(params.setType && params.setType.length > 0 ? { setType: params.setType } : {}),
      })
    );
  }
}

export async function deleteProjectMilestoneAtIndex(params: {
  source: UpdateSource;
  projectId: string;
  index: number;
}) {
  const api = requireSource(params.source);
  return api.endpointApi.updatePathValue(
    normalizeUpdatePathValuePayload({
      id: params.projectId,
      collection: "projects",
      path: `oceco.milestones.${params.index}`,
      pull: "oceco.milestones",
      value: null,
    })
  );
}

export async function deleteAnswerDepenseAtIndex(params: {
  source: UpdateSource;
  answerId: string;
  index: number;
}) {
  const api = requireSource(params.source);
  return api.endpointApi.updatePathValue(
    normalizeUpdatePathValuePayload({
      id: params.answerId,
      collection: "answers",
      path: `answers.aapStep1.depense.${params.index}`,
      pull: "answers.aapStep1.depense",
      value: null,
    })
  );
}
