import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocalization } from "@/hooks/useLocalization";
import { TableSectionProps } from '@/types/site-schema';

export function TableSection({ id, props }: { id?: string; props: TableSectionProps }) {
  const { t } = useLocalization();
  const { headers, rows, sortable = true, pagination = false, perPage = 10 } = props;
  
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const sortedRows = useMemo(() => {
    if (!sortable || sortColumn === null) return rows;

    return [...rows].sort((a, b) => {
      const aValue = t(a[sortColumn]);
      const bValue = t(b[sortColumn]);
      
      const comparison = aValue.localeCompare(bValue, undefined, { numeric: true });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [rows, sortColumn, sortDirection, sortable, t]);

  const paginatedRows = useMemo(() => {
    if (!pagination) return sortedRows;
    
    const startIndex = (currentPage - 1) * perPage;
    return sortedRows.slice(startIndex, startIndex + perPage);
  }, [sortedRows, pagination, currentPage, perPage]);

  const totalPages = Math.ceil(sortedRows.length / perPage);

  const handleSort = (columnIndex: number) => {
    if (!sortable) return;
    
    if (sortColumn === columnIndex) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnIndex);
      setSortDirection('asc');
    }
  };

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((header, index) => (
                    <TableHead 
                      key={index}
                      className={sortable ? "cursor-pointer hover:bg-muted/50" : ""}
                      onClick={() => handleSort(index)}
                    >
                      <div className="flex items-center gap-2">
                        {t(header)}
                        {sortable && (
                          <div className="flex flex-col">
                            <ChevronUp 
                              className={`w-3 h-3 ${
                                sortColumn === index && sortDirection === 'asc' 
                                  ? 'text-primary' 
                                  : 'text-muted-foreground'
                              }`} 
                            />
                            <ChevronDown 
                              className={`w-3 h-3 -mt-1 ${
                                sortColumn === index && sortDirection === 'desc' 
                                  ? 'text-primary' 
                                  : 'text-muted-foreground'
                              }`} 
                            />
                          </div>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex}>
                        {t(cell)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Précédent
              </Button>
              
              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="w-10 h-10 p-0"
                  >
                    {page}
                  </Button>
                ))}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Suivant
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}