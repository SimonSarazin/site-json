import { Fragment } from 'react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { useLocalization } from "@/hooks/useLocalization";
import { useNavigate } from "react-router";

interface BreadcrumbSectionProps {
  id?: string;
  props: {
    items: Array<{
      label: Record<string, string>;
      href?: string;
    }>;
    separator?: string;
  };
}

export function BreadcrumbSection({ id, props }: BreadcrumbSectionProps) {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const { items, separator = "/" } = props;

  return (
    <section id={id} className="py-4 bg-muted/30 border-b">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Breadcrumb>
          <BreadcrumbList>
            {items.map((item, index) => (
              <Fragment key={index}>
                <BreadcrumbItem>
                  {index === items.length - 1 ? (
                    <BreadcrumbPage>{t(item.label)}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink 
                      onClick={() => item.href && navigate(item.href)}
                      className={item.href ? "cursor-pointer hover:text-foreground" : ""}
                    >
                      {t(item.label)}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index < items.length - 1 && (
                  <BreadcrumbSeparator>{separator}</BreadcrumbSeparator>
                )}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </section>
  );
}