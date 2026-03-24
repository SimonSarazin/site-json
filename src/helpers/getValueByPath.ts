// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getValueByPath = (obj: Record<string, any>, path: string): any => {
    return path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj);
}
export default getValueByPath;