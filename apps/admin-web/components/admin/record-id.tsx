type RecordIdProps = {
  label: string;
  value: string;
};

export function RecordId({ label, value }: RecordIdProps) {
  return (
    <p className="text-xs leading-5 text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span>{' '}
      <code className="select-all break-all font-mono text-foreground">{value}</code>
    </p>
  );
}
