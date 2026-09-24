"use client";

import Link from "next/link";
import Button, { type ButtonProps } from "@mui/material/Button";

/**
 * MUI Button rendered as a Next.js Link.
 *
 * Needed because MUI's `component` prop takes a component *reference*, and a
 * Server Component cannot pass a function across the boundary to a Client
 * Component ("Functions cannot be passed directly to Client Components").
 * Wrapping the pairing in a client component keeps the page files server-side.
 */
export function LinkButton({
  href,
  ...props
}: ButtonProps & { href: string }) {
  return <Button component={Link} href={href} {...props} />;
}
