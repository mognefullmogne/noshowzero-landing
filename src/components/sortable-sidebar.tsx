"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  type SidebarLink,
  getOrderedSidebarLinks,
} from "@/lib/sidebar-links";

// ── Sortable nav item ──────────────────────────────────────────────

interface SortableNavItemProps {
  readonly link: SidebarLink;
  readonly isActive: boolean;
}

function SortableNavItem({ link, isActive }: SortableNavItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.href });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <Link
        href={link.href}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all select-none",
          isActive
            ? "bg-blue-50 text-blue-700"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
          isDragging && "opacity-0",
        )}
      >
        <link.icon className="h-5 w-5 flex-shrink-0" />
        {link.label}
      </Link>
    </div>
  );
}

// ── Drag overlay (the floating item while dragging) ────────────────

function DragOverlayItem({ link, isActive }: { link: SidebarLink; isActive: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
        "shadow-lg ring-1 ring-black/5 scale-[1.02] bg-white",
        isActive ? "text-blue-700" : "text-gray-600",
      )}
    >
      <link.icon className="h-5 w-5 flex-shrink-0" />
      {link.label}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────

interface SortableSidebarProps {
  readonly pathname: string;
  readonly sidebarOrder: string[] | null;
}

export function SortableSidebar({ pathname, sidebarOrder }: SortableSidebarProps) {
  const initialLinks = useMemo(
    () => getOrderedSidebarLinks(sidebarOrder),
    [sidebarOrder],
  );

  const [links, setLinks] = useState<readonly SidebarLink[]>(initialLinks);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Long-press activation: 200ms delay, 5px tolerance
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  const hrefIds = useMemo(() => links.map((l) => l.href), [links]);

  const activeLink = useMemo(
    () => (activeId ? links.find((l) => l.href === activeId) ?? null : null),
    [activeId, links],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);

      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = links.findIndex((l) => l.href === active.id);
      const newIndex = links.findIndex((l) => l.href === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove([...links], oldIndex, newIndex);
      setLinks(reordered);

      // Persist optimistically
      const order = reordered.map((l) => l.href);
      fetch("/api/settings/sidebar-order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      }).catch((err) => {
        console.error("Failed to save sidebar order:", err);
      });
    },
    [links],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={hrefIds} strategy={verticalListSortingStrategy}>
        <nav className="flex-1 space-y-1 p-4">
          {links.map((link) => (
            <SortableNavItem
              key={link.href}
              link={link}
              isActive={pathname === link.href}
            />
          ))}
        </nav>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeLink ? (
          <DragOverlayItem link={activeLink} isActive={pathname === activeLink.href} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
