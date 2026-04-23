const SectionTitle = ({ label, count }: { label: string; count?: number }) => {
    return (
        <div className="w-max flex items-center gap-2 mb-3 rounded-[10px] border px-3 py-1.5 border-foreground/20">
            <h4 className="font-semibold text-sm text-foreground">{label}</h4>
            {count !== undefined && count > 0 && (
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5 leading-none">
                    {count}
                </span>
            )}
        </div>
    );
}
export default SectionTitle;