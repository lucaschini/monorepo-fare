export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clientes/:path*",
    "/catalogo/:path*",
    "/orcamentos/:path*",
    "/pedidos/:path*",
    "/estoque/:path*",
    "/notas/:path*",
    "/fiscal/:path*",
  ],
};
