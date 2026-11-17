import { useEffect, useState } from "react";
import { useCustomers, useDeleteCustomer } from "@/entities/customer/api";
import { ChipProductoEscaneado, frasesClientes, useFiltroEscaneado, useVozAlFiltrar } from "@/features/scanner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  FilaAcciones,
  FilaDatos,
  FilaTitulo,
  ListaTarjetas,
  SoloEscritorio,
  TarjetaFila,
} from "@/shared/ui/lista-tarjetas";
import { PaginationControls } from "@/shared/ui/pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Search, User, Mail, Phone, Calendar, Users, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState } from "@/shared/ui/empty-state";
import { Customer } from "@/entities/customer/model/types";
import { format } from "date-fns";
import { CustomerFormModal } from "./CustomerFormModal";
import { toast } from "sonner";
import { useFiltrosUrl } from "@/shared/hooks/use-filtros-url";
import { useAcceso } from "@/app/providers/acceso";
import { PERMISO } from "@/shared/acceso/permisos";

export default function CustomersTable() {
  // Ver clientes alcanza para la lista; crear, editar y borrar piden gestionar.
  const puedeGestionar = useAcceso().puede(PERMISO.GESTIONAR_CLIENTES);
  // La búsqueda vive en la dirección: volver a la lista la conserva.
  const { filtros, borrador, setFiltro, limpiar } = useFiltrosUrl(
    { q: "", pagina: 1, tam: 10 },
    { diferidas: ["q"], reiniciar: "pagina", ignorar: ["tam"] },
  );
  const searchTerm = filtros.q;
  const currentPage = filtros.pagina;
  const pageSize = filtros.tam;
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const deleteMutation = useDeleteCustomer();

  // Escanear un producto deja a los clientes que lo compraron: a quién
  // avisarle que llegó o a quién ofrecérselo de nuevo.
  const filtro = useFiltroEscaneado("Muestra los clientes que compraron ese producto");

  // Query params para el backend
  const queryParams = {
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
    order: "DESC" as const,
    ...(searchTerm && { attr: "name", value: searchTerm }),
    ...(filtro.producto && { productId: filtro.producto.id }),
  };

  const { data: customersResponse, isLoading, isFetching } = useCustomers(queryParams);
  // "Mermelada Arcor. Te lo compraron cuatro clientes."
  useVozAlFiltrar(filtro.producto, !isFetching, () =>
    frasesClientes(filtro.producto!.nombre, customersResponse?.countData ?? 0),
  );

  // Otro producto escaneado: desde la primera página.
  const productoFiltrado = filtro.producto?.id;
  useEffect(() => {
    if (productoFiltrado) setFiltro("pagina", 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoFiltrado]);
  
  const customers = customersResponse?.data || [];
  const totalItems = customersResponse?.countData || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  const handlePageChange = (page: number) => setFiltro("pagina", page);
  const handlePageSizeChange = (newPageSize: number) => setFiltro("tam", newPageSize);

  const handleCustomerClick = (customer: Customer) => {
    if (!puedeGestionar) return;
    setCustomerToEdit(customer);
    setIsFormModalOpen(true);
  };

  const handleCreateCustomer = () => {
    setCustomerToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation(); // Evitar que se abra el modal de edición
    setCustomerToDelete(customer);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    
    try {
      await deleteMutation.mutateAsync(customerToDelete.id);
      toast.success("Cliente eliminado correctamente");
      setIsDeleteDialogOpen(false);
      setCustomerToDelete(null);
    } catch (error) {
      toast.error("Error al eliminar el cliente");
    }
  };

  const getGenderBadge = (gender?: string) => {
    const genderConfig = {
      male: { label: "Masculino", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" },
      female: { label: "Femenino", className: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100" },
      other: { label: "Otro", className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100" },
    };
    
    if (!gender) return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100">No especificado</Badge>;
    
    const config = genderConfig[gender as keyof typeof genderConfig] || { label: gender, className: "bg-gray-100 text-gray-800" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Clientes</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Gestiona tu base de clientes
          </p>
        </div>
        {puedeGestionar ? (
          <div className="flex items-center gap-4">
            <Button onClick={handleCreateCustomer}>
              <Plus className="w-4 h-4 mr-2" />
              Crear Cliente
            </Button>
          </div>
        ) : null}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Buscar por nombre de cliente..."
          value={borrador.q}
          onChange={(e) => setFiltro("q", e.target.value)}
          className="pl-10"
        />
      </div>

      {filtro.producto && (
        <ChipProductoEscaneado
          nombre={filtro.producto.nombre}
          imagen={filtro.producto.imagen}
          cargando={isLoading}
          resumen={
            totalItems === 0
              ? "Ningún cliente registrado lo compró todavía."
              : `${totalItems} ${totalItems === 1 ? "cliente lo compró" : "clientes lo compraron"}.`
          }
          onQuitar={filtro.quitar}
          quitarEtiqueta="Ver todos los clientes"
        />
      )}

      {/* Table */}
      {customers.length === 0 && !isLoading && filtro.producto ? null : customers.length === 0 && !isLoading ? (
        searchTerm ? (
          <EmptyState
            icon={Users}
            title="No encontramos clientes"
            description="Prueba con otro nombre o limpia la búsqueda."
            primaryAction={{
              label: "Limpiar búsqueda",
              variant: "outline",
              onClick: limpiar,
            }}
          />
        ) : (
          <EmptyState
            icon={Users}
            title="Aún no tienes clientes"
            description="Tus clientes se registran automáticamente cuando hacen una compra en caja o desde tu tienda online. También puedes agregarlos manualmente."
            primaryAction={{
              label: "Agregar cliente",
              icon: Plus,
              onClick: handleCreateCustomer,
            }}
          />
        )
      ) : (
        <SoloEscritorio className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Género</TableHead>
                <TableHead>Fecha de Registro</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    <TableCell><div className="flex items-center gap-2"><Skeleton className="h-4 w-4 rounded" /><Skeleton className="h-4 w-28" /></div></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-8 w-8 rounded-md mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : (
              customers.map((customer) => (
                <TableRow 
                  key={customer.id}
                  onClick={() => handleCustomerClick(customer)}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{customer.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{customer.country || "+591"}</span>
                      {customer.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.email ? (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        {customer.email}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getGenderBadge(customer.gender)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {format(new Date(customer.created_at), "dd/MM/yyyy")}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {puedeGestionar ? <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteClick(e, customer)}
                      disabled={deleteMutation.isPending}
                      className="hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900 dark:hover:text-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button> : null}
                  </TableCell>
                </TableRow>
              ))
              )}
            </TableBody>
          </Table>
        </SoloEscritorio>
      )}

      {/* La misma información en el teléfono: nombre y teléfono, que es por
          donde se busca a un cliente, y la fecha como dato secundario. El
          email y el género se ven al abrir la ficha. */}
      {!isLoading && customers.length > 0 && (
        <ListaTarjetas>
          {customers.map((customer) => (
            <TarjetaFila
              key={customer.id}
              onClick={() => handleCustomerClick(customer)}
            >
              <FilaTitulo
                medio={
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <User className="size-4" />
                  </span>
                }
                titulo={customer.name}
                subtitulo={`${customer.country || "+591"} ${customer.phone}`}
                derecha={getGenderBadge(customer.gender)}
              />
              <FilaDatos
                datos={[
                  {
                    etiqueta: "Registrado",
                    valor: format(new Date(customer.created_at), "dd/MM/yyyy"),
                  },
                  { etiqueta: "Email", valor: customer.email || "—" },
                ]}
              />
            </TarjetaFila>
          ))}
        </ListaTarjetas>
      )}

      {/* Pagination */}
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* Modal de crear/editar */}
      <CustomerFormModal
        customer={customerToEdit}
        open={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
      />

      {/* Dialog de confirmación de eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-200" />
              </div>
              <AlertDialogTitle className="text-xl">¿Eliminar Cliente?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-3">
              Estás a punto de eliminar a <strong>{customerToDelete?.name}</strong>.
              <br />
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteDialogOpen(false);
              setCustomerToDelete(null);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
