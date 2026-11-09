import { notFound } from "next/navigation";
import { Superapp } from "@/components/superapp/Superapp";
import { sesionClienteActual } from "@/lib/auth/cliente";
import { esLocale } from "@/lib/i18n/locales";

export default async function LayoutSuperapp({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!esLocale(lang)) notFound();
  const cliente = await sesionClienteActual();
  // Solo dígitos: wa.me no acepta «+» ni espacios.
  const whatsapp = process.env.HESTIA_WHATSAPP_NUMERO?.replace(/\D/g, "") || null;
  return (
    <Superapp locale={lang} cliente={cliente ? { email: cliente.email } : null} whatsapp={whatsapp}>
      {children}
    </Superapp>
  );
}
