import { updatePathValue } from "@/lib/updatePathValue";

type UpdateSource = unknown;
type UpdateSetType = string | Array<{ path: string; type: string }>;

type EndpointCaller = {
  callEndpoint?: (endpointName: string, payload: Record<string, unknown>) => Promise<unknown>;
  _client?: {
    request?: (config: {
      url: string;
      method: string;
      headers?: Record<string, string>;
      data?: unknown;
    }) => Promise<unknown>;
  };
};

type UpdateAnswerMilestoneParams = {
  kind: "milestone";
  source: UpdateSource;
  answerId: string;
  index: string;
  field: string;
  value: unknown;
  setType?: UpdateSetType;
};

type UpdateProjectActionParams = {
  kind: "action";
  source: UpdateSource;
  projectId: string;
  index: string;
  field: string;
  value: unknown;
  setType?: UpdateSetType;
};

export async function updateActionOrMilestoneField(
  params: UpdateAnswerMilestoneParams | UpdateProjectActionParams
) {
  const safeSetType =
    typeof params.setType === "string"
      ? params.setType
      : Array.isArray(params.setType) && params.setType.length > 0
        ? params.setType
        : undefined;

  if (params.kind === "action") {
    return updatePathValue(params.source, {
      id: params.index,
      collection: "actions",
      path: params.field,
      value: params.value,
      ...(safeSetType ? { setType: safeSetType } : {}),
    });
  }

  if (params.kind === "milestone") {
    return updatePathValue(params.source, {
      id: params.answerId,
      collection: "answers",
      path: `answers.aapStep1.depense.${params.index}.${params.field}`,
      value: params.value,
      ...(safeSetType ? { setType: safeSetType } : {}),
    });
  }

  throw new Error("updateActionOrMilestoneField: kind non supporte");
}

export async function updateProjectActionFields(params: {
  source: UpdateSource;
  projectId: string;
  index: string;
  fields: Record<string, unknown>;
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
  return updatePathValue(params.source, {
    id: params.projectId,
    collection: 'projects',
    path: 'oceco.milestones',
    value: params.milestone,
    arrayForm: true,
  });
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
  return updatePathValue(params.source, {
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
  });
}

export const deleteActionById = async (params: {
  source: UpdateSource;
  actionId: string;
}) => {
  const source = params.source as EndpointCaller;

  if (typeof source.callEndpoint === "function") {
    try {
      return await source.callEndpoint("DELETE_ACTION_BY_ID", { id: params.actionId });
    } catch {
      // Fallback HTTP direct si l'endpoint custom n'est pas encore injecte.
    }
  }

  if (typeof source._client?.request === "function") {
    return source._client.request({
      url: `/co2/element/delete/type/actions/id/${params.actionId}`,
      method: "post",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  }

  throw new Error("Suppression action indisponible: source API incompatible.");
};

export async function updateProjectMilestoneFields(params: {
  source: UpdateSource;
  projectId: string;
  index: number;
  fields: Record<string, unknown>;
}) {
  const entries = Object.entries(params.fields);
  for (const [field, value] of entries) {
    await updatePathValue(params.source, {
      id: params.projectId,
      collection: "projects",
      path: `oceco.milestones.${params.index}.${field}`,
      value,
    });
  }
}

export async function updateAnswerDepenseFields(params: {
  source: UpdateSource;
  answerId: string;
  index: number;
  fields: Record<string, unknown>;
  setType?: UpdateSetType;
}) {
  const entries = Object.entries(params.fields);
  for (const [field, value] of entries) {
    await updatePathValue(params.source, {
      id: params.answerId,
      collection: "answers",
      path: `answers.aapStep1.depense.${params.index}.${field}`,
      value,
      ...(params.setType && params.setType.length > 0 ? { setType: params.setType } : {}),
    });
  }
}

export async function deleteProjectMilestoneAtIndex(params: {
  source: UpdateSource;
  projectId: string;
  index: number;
}) {
  return updatePathValue(params.source, {
    id: params.projectId,
    collection: "projects",
    path: `oceco.milestones.${params.index}`,
    pull: "oceco.milestones",
    value: null,
  });
}

export async function deleteAnswerDepenseAtIndex(params: {
  source: UpdateSource;
  answerId: string;
  index: number;
}) {
  return updatePathValue(params.source, {
    id: params.answerId,
    collection: "answers",
    path: `answers.aapStep1.depense.${params.index}`,
    pull: "answers.aapStep1.depense",
    value: null,
  });
}

