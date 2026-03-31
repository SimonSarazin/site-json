const getValueByPath = (obj: Record<string, unknown>, path: string): unknown => {
    return path.split('.').reduce<unknown>((o, p) => (o ? (o as Record<string, unknown>)[p] : undefined), obj);
}
export default getValueByPath;
