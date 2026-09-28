"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { cn } from "../lib/cn";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

interface PaginationInfoProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  className?: string;
}

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

const Pagination = React.forwardRef<HTMLDivElement, PaginationProps>(
  ({ currentPage, totalPages, onPageChange, className, ...props }, ref) => {
    const getVisiblePages = () => {
      const pages: (number | string)[] = [];
      const maxVisible = 3; // Máximo 3 números visibles
      
      if (totalPages <= maxVisible) {
        // Si hay pocas páginas, mostrar todas
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Lógica simplificada para 3 páginas máximo
        if (currentPage <= 2) {
          // Inicio: [1] [2] [3] ... [última]
          pages.push(1, 2, 3);
          if (totalPages > 4) pages.push('...');
          if (totalPages > 3) pages.push(totalPages);
        } else if (currentPage >= totalPages - 1) {
          // Final: [1] ... [n-2] [n-1] [n]
          pages.push(1);
          if (totalPages > 4) pages.push('...');
          pages.push(totalPages - 2, totalPages - 1, totalPages);
        } else {
          // Medio: [1] ... [actual-1] [actual] [actual+1] ... [última]
          pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
        }
      }
      
      return pages;
    };

    const visiblePages = getVisiblePages();

    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-2", className)}
        {...props}
      >
        {/* Botón Anterior */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="h-9 w-9 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Números de página */}
        <div className="flex items-center gap-1">
          {visiblePages.map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className="px-2 text-muted-foreground">...</span>
              ) : (
                <Button
                  variant={currentPage === page ? "navy" : "ghost"}
                  size="sm"
                  onClick={() => onPageChange(page as number)}
                  aria-current={currentPage === page ? "page" : undefined}
                  className="cifra h-9 w-9 p-0 text-[13px]"
                >
                  {page}
                </Button>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Botón Siguiente */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="h-9 w-9 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }
);

Pagination.displayName = "Pagination";

const PaginationInfo = React.forwardRef<HTMLDivElement, PaginationInfoProps>(
  ({ currentPage, pageSize, totalItems, className, ...props }, ref) => {
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    return (
      <div
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
      >
        Mostrando {startItem} a {endItem} de {totalItems} resultados
      </div>
    );
  }
);

PaginationInfo.displayName = "PaginationInfo";

const PaginationControls = React.forwardRef<HTMLDivElement, PaginationControlsProps>(
  ({ 
    currentPage, 
    totalPages, 
    pageSize, 
    totalItems, 
    onPageChange, 
    onPageSizeChange,
    pageSizeOptions = [5, 10, 20, 50],
    className,
    ...props 
  }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}
        {...props}
      >
        {/* Info y selector de filas */}
        <div className="flex items-center gap-4">
          <PaginationInfo
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalItems}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filas por página:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(parseInt(value))}
            >
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Controles de paginación */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </div>
    );
  }
);

PaginationControls.displayName = "PaginationControls";

export { Pagination, PaginationInfo, PaginationControls };
