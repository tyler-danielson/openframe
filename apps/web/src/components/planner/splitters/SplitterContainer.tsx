import { useCallback, useRef, useState } from "react";
import { Rows, Columns, X, Plus, ArrowUp, ArrowDown, Equal } from "lucide-react";
import type { LayoutSection, LayoutChild, PlannerWidgetInstance, PlannerWidgetType } from "@openframe/shared";
import { VerticalSplitter } from "./VerticalSplitter";
import { HorizontalSplitter } from "./HorizontalSplitter";
import { AddWidgetModal } from "../AddWidgetModal";

interface SplitterContainerProps {
  section: LayoutSection;
  widgets: PlannerWidgetInstance[];
  selectedWidgetId: string | null;
  selectedSlotId: string | null;
  onSelectWidget: (id: string | null) => void;
  onSelectSlot: (slotId: string | null) => void;
  onSectionUpdate: (sectionId: string, children: LayoutChild[]) => void;
  onAddSplit: (parentSectionId: string, childId: string, direction: "horizontal" | "vertical") => void;
  onAssignWidget: (slotId: string, widgetId: string) => void;
  onRemoveSlot: (parentSectionId: string, childId: string) => void;
  onCreateWidget: (slotId: string, widgetType: PlannerWidgetType) => void;
  onAddRowAbove: (parentSectionId: string, childId: string) => void;
  onAddRowBelow: (parentSectionId: string, childId: string) => void;
  onDistributeEvenly: (sectionId: string) => void;
  renderWidget: (widget: PlannerWidgetInstance, isSelected: boolean) => React.ReactNode;
  depth?: number;
}

export function SplitterContainer({
  section,
  widgets,
  selectedWidgetId,
  selectedSlotId,
  onSelectWidget,
  onSelectSlot,
  onSectionUpdate,
  onAddSplit,
  onAssignWidget,
  onRemoveSlot,
  onCreateWidget,
  onAddRowAbove,
  onAddRowBelow,
  onDistributeEvenly,
  renderWidget,
  depth = 0,
}: SplitterContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSplitterDrag = useCallback(
    (childIndex: number, deltaPixels: number) => {
      if (!containerRef.current) return;

      const children = [...section.children];
      const totalFlex = children.reduce((sum, c) => sum + c.flex, 0);

      // Get container size based on direction
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerSize = section.direction === "horizontal"
        ? containerRect.width
        : containerRect.height;

      // Calculate pixels per flex unit
      const pixelsPerFlex = containerSize / totalFlex;
      const flexDelta = deltaPixels / pixelsPerFlex;

      // Adjust flex of adjacent children (minimum 0.1 flex)
      const minFlex = 0.1;
      const childA = children[childIndex];
      const childB = children[childIndex + 1];

      if (!childA || !childB) return;

      const newFlexA = Math.max(minFlex, childA.flex + flexDelta);
      const newFlexB = Math.max(minFlex, childB.flex - flexDelta);

      // Only update if both values are valid
      if (newFlexA >= minFlex && newFlexB >= minFlex) {
        children[childIndex] = { ...childA, flex: newFlexA };
        children[childIndex + 1] = { ...childB, flex: newFlexB };
        onSectionUpdate(section.id, children);
      }
    },
    [section, onSectionUpdate]
  );

  const isHorizontal = section.direction === "horizontal";

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full"
      style={{
        flexDirection: isHorizontal ? "row" : "column",
      }}
    >
      {section.children.map((child, index) => (
        <div key={child.id} className="flex" style={{ flex: child.flex, minWidth: 0, minHeight: 0, flexDirection: isHorizontal ? "row" : "column" }}>
          {/* Render child content */}
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
            {child.type === "widget" ? (
              <WidgetSlot
                slotId={child.id}
                widgetId={child.widgetId}
                widgets={widgets}
                selectedWidgetId={selectedWidgetId}
                selectedSlotId={selectedSlotId}
                onSelectWidget={onSelectWidget}
                onSelectSlot={onSelectSlot}
                onAddSplit={(direction) => onAddSplit(section.id, child.id, direction)}
                onAssignWidget={(widgetId) => onAssignWidget(child.id, widgetId)}
                onCreateWidget={(widgetType) => onCreateWidget(child.id, widgetType)}
                onAddRowAbove={() => onAddRowAbove(section.id, child.id)}
                onAddRowBelow={() => onAddRowBelow(section.id, child.id)}
                onDistributeEvenly={section.children.length > 1 ? () => onDistributeEvenly(section.id) : undefined}
                onRemove={section.children.length > 1 ? () => onRemoveSlot(section.id, child.id) : undefined}
                renderWidget={renderWidget}
              />
            ) : child.section ? (
              <SplitterContainer
                section={child.section}
                widgets={widgets}
                selectedWidgetId={selectedWidgetId}
                selectedSlotId={selectedSlotId}
                onSelectWidget={onSelectWidget}
                onSelectSlot={onSelectSlot}
                onSectionUpdate={onSectionUpdate}
                onAddSplit={onAddSplit}
                onAssignWidget={onAssignWidget}
                onRemoveSlot={onRemoveSlot}
                onCreateWidget={onCreateWidget}
                onAddRowAbove={onAddRowAbove}
                onAddRowBelow={onAddRowBelow}
                onDistributeEvenly={onDistributeEvenly}
                renderWidget={renderWidget}
                depth={depth + 1}
              />
            ) : (
              <EmptySlot
                slotId={child.id}
                isSelected={selectedSlotId === child.id}
                onSelect={() => onSelectSlot(child.id)}
                onAddSplit={(direction) => onAddSplit(section.id, child.id, direction)}
                onCreateWidget={(widgetType) => onCreateWidget(child.id, widgetType)}
                onAddRowAbove={() => onAddRowAbove(section.id, child.id)}
                onAddRowBelow={() => onAddRowBelow(section.id, child.id)}
                onDistributeEvenly={section.children.length > 1 ? () => onDistributeEvenly(section.id) : undefined}
                onRemove={section.children.length > 1 ? () => onRemoveSlot(section.id, child.id) : undefined}
              />
            )}
          </div>

          {/* Render splitter between children (not after last) */}
          {index < section.children.length - 1 && (
            isHorizontal ? (
              <VerticalSplitter onDrag={(delta) => handleSplitterDrag(index, delta)} />
            ) : (
              <HorizontalSplitter onDrag={(delta) => handleSplitterDrag(index, delta)} />
            )
          )}
        </div>
      ))}
    </div>
  );
}

interface WidgetSlotProps {
  slotId: string;
  widgetId: string | undefined;
  widgets: PlannerWidgetInstance[];
  selectedWidgetId: string | null;
  selectedSlotId: string | null;
  onSelectWidget: (id: string | null) => void;
  onSelectSlot: (slotId: string | null) => void;
  onAddSplit: (direction: "horizontal" | "vertical") => void;
  onAssignWidget: (widgetId: string) => void;
  onCreateWidget: (widgetType: PlannerWidgetType) => void;
  onAddRowAbove: () => void;
  onAddRowBelow: () => void;
  onDistributeEvenly?: () => void;
  onRemove?: () => void;
  renderWidget: (widget: PlannerWidgetInstance, isSelected: boolean) => React.ReactNode;
}

function WidgetSlot({
  slotId,
  widgetId,
  widgets,
  selectedWidgetId,
  selectedSlotId,
  onSelectWidget,
  onSelectSlot,
  onAddSplit,
  onAssignWidget,
  onCreateWidget,
  onAddRowAbove,
  onAddRowBelow,
  onDistributeEvenly,
  onRemove,
  renderWidget
}: WidgetSlotProps) {
  const [showActions, setShowActions] = useState(false);
  const [showAddWidgetModal, setShowAddWidgetModal] = useState(false);
  const widget = widgetId ? widgets.find((w) => w.id === widgetId) : undefined;

  if (!widget) {
    return (
      <EmptySlot
        slotId={slotId}
        isSelected={selectedSlotId === slotId}
        onSelect={() => onSelectSlot(slotId)}
        onAddSplit={onAddSplit}
        onCreateWidget={onCreateWidget}
        onAddRowAbove={onAddRowAbove}
        onAddRowBelow={onAddRowBelow}
        onDistributeEvenly={onDistributeEvenly}
        onRemove={onRemove}
      />
    );
  }

  const isSelected = selectedWidgetId === widget.id;

  return (
    <div
      className={`h-full w-full relative group ${isSelected ? "ring-2 ring-blue-500 ring-inset" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelectWidget(widget.id);
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {renderWidget(widget, isSelected)}

      {/* Action buttons on hover */}
      {showActions && (
        <>
          {/* Add row above - top center */}
          <button
            onClick={(e) => { e.stopPropagation(); onAddRowAbove(); }}
            className="absolute top-1 left-1/2 -translate-x-1/2 p-1 bg-white/90 rounded shadow hover:bg-white print:hidden"
            title="Add row above"
          >
            <ArrowUp className="h-3 w-3 text-gray-600" />
          </button>

          {/* Add row below - bottom center */}
          <button
            onClick={(e) => { e.stopPropagation(); onAddRowBelow(); }}
            className="absolute bottom-1 left-1/2 -translate-x-1/2 p-1 bg-white/90 rounded shadow hover:bg-white print:hidden"
            title="Add row below"
          >
            <ArrowDown className="h-3 w-3 text-gray-600" />
          </button>

          {/* Main toolbar - top right */}
          <div className="absolute top-1 right-1 flex gap-1 print:hidden">
            <button
              onClick={(e) => { e.stopPropagation(); setShowAddWidgetModal(true); }}
              className="p-1 bg-blue-500 rounded shadow hover:bg-blue-600"
              title="Replace widget"
            >
              <Plus className="h-3 w-3 text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAddSplit("horizontal"); }}
              className="p-1 bg-white/90 rounded shadow hover:bg-white"
              title="Split into columns"
            >
              <Columns className="h-3 w-3 text-gray-600" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAddSplit("vertical"); }}
              className="p-1 bg-white/90 rounded shadow hover:bg-white"
              title="Split into rows"
            >
              <Rows className="h-3 w-3 text-gray-600" />
            </button>
            {onDistributeEvenly && (
              <button
                onClick={(e) => { e.stopPropagation(); onDistributeEvenly(); }}
                className="p-1 bg-white/90 rounded shadow hover:bg-white"
                title="Distribute evenly"
              >
                <Equal className="h-3 w-3 text-gray-600" />
              </button>
            )}
            {onRemove && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="p-1 bg-white/90 rounded shadow hover:bg-red-50"
                title="Remove section"
              >
                <X className="h-3 w-3 text-red-500" />
              </button>
            )}
          </div>
        </>
      )}

      {/* Add Widget Modal */}
      <AddWidgetModal
        isOpen={showAddWidgetModal}
        onClose={() => setShowAddWidgetModal(false)}
        onSelectWidget={onCreateWidget}
      />
    </div>
  );
}

interface EmptySlotProps {
  slotId: string;
  isSelected?: boolean;
  onSelect?: () => void;
  onAddSplit: (direction: "horizontal" | "vertical") => void;
  onCreateWidget: (widgetType: PlannerWidgetType) => void;
  onAddRowAbove: () => void;
  onAddRowBelow: () => void;
  onDistributeEvenly?: () => void;
  onRemove?: () => void;
}

function EmptySlot({ slotId, isSelected, onSelect, onAddSplit, onCreateWidget, onAddRowAbove, onAddRowBelow, onDistributeEvenly, onRemove }: EmptySlotProps) {
  const [showAddWidgetModal, setShowAddWidgetModal] = useState(false);

  return (
    <div
      className={`h-full w-full flex flex-col items-center justify-center bg-gray-50/50 border border-dashed rounded relative group ${isSelected ? "ring-2 ring-blue-500 ring-inset border-blue-400" : "border-gray-300"}`}
      onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
    >
      {/* Add row above - top */}
      <button
        onClick={onAddRowAbove}
        className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
        title="Add row above"
      >
        <ArrowUp className="h-3 w-3" />
        Row
      </button>

      {/* Center content */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-gray-400 text-xs uppercase tracking-wide">Empty Section</span>

        <div className="flex gap-1">
          <button
            onClick={() => onAddSplit("horizontal")}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
            title="Split into columns"
          >
            <Columns className="h-3 w-3" />
            Columns
          </button>
          <button
            onClick={() => onAddSplit("vertical")}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
            title="Split into rows"
          >
            <Rows className="h-3 w-3" />
            Rows
          </button>
        </div>

        {onDistributeEvenly && (
          <button
            onClick={onDistributeEvenly}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
            title="Distribute evenly"
          >
            <Equal className="h-3 w-3" />
            Distribute
          </button>
        )}

        <button
          onClick={() => setShowAddWidgetModal(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          <Plus className="h-3 w-3" />
          Add Widget
        </button>
      </div>

      {/* Add row below - bottom */}
      <button
        onClick={onAddRowBelow}
        className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
        title="Add row below"
      >
        <ArrowDown className="h-3 w-3" />
        Row
      </button>

      {/* Remove button */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 p-1 bg-white/90 rounded shadow hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove section"
        >
          <X className="h-3 w-3 text-red-500" />
        </button>
      )}

      {/* Add Widget Modal */}
      <AddWidgetModal
        isOpen={showAddWidgetModal}
        onClose={() => setShowAddWidgetModal(false)}
        onSelectWidget={onCreateWidget}
      />
    </div>
  );
}
