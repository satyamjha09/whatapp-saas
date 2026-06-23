export function scopedByCompany<TWhere extends object>({
  companyId,
  where,
}: {
  companyId: string;
  where?: TWhere;
}) {
  return {
    ...(where ?? {}),
    companyId,
  } as TWhere & {
    companyId: string;
  };
}

export function scopedByCompanyRelation<TWhere extends object>({
  companyId,
  relationName,
  where,
}: {
  companyId: string;
  relationName: string;
  where?: TWhere;
}) {
  return {
    ...(where ?? {}),
    [relationName]: {
      companyId,
    },
  };
}
