"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Onglets soulignés de la maquette (Connexion / Inscription) : actif en gras avec
// filet indigo de 2 px, inactif en gris.
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex w-full border-b", className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative -mb-px flex h-12 flex-1 items-center justify-center border-b-2 border-transparent text-body font-medium text-foreground-secondary transition-colors duration-150 outline-none hover:text-foreground focus-visible:bg-primary-soft data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content data-slot="tabs-content" className={cn("outline-none", className)} {...props} />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
