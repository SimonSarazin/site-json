import React from 'react';

interface HTMLSectionProps {
  id?: string;
  props: {
    html: string;
  };
}

export function HTMLSection({ id, props }: HTMLSectionProps) {
  const { html } = props;

  return (
    <section id={id}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}