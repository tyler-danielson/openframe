import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import type { PlannerLayoutConfig, PlannerWidgetInstance, LayoutSection, LayoutChild, ColumnLayout, PlannerWidgetType } from "@openframe/shared";
import { SplitterContainer } from "./splitters";
import { renderEditableWidget, plannerColors } from "./editable-widgets";
import { getPresetById } from "../../lib/planner/device-presets";
import { PLANNER_WIDGET_REGISTRY } from "../../lib/planner/widget-registry";
import { ArrowUp, ArrowDown, Columns, Rows, Equal, Plus, X, Replace } from "lucide-react";
import { AddWidgetModal } from "./AddWidgetModal";

// Generate a unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Create a default empty layout
function createEmptyLayout(): ColumnLayout {
  return {
    sections: [{
      id: "main",
      direction: "vertical",
      children: [
        { id: generateId(), type: "widget", flex: 1, widgetId: undefined },
      ],
    }],
  };
}

interface PlannerLiveEditorProps {
  layoutConfig: PlannerLayoutConfig;
  selectedWidgetId: string | null;
  onSelectWidget: (id: string | null) => void;
  onUpdateWidget: (id: string, updates: Partial<PlannerWidgetInstance>) => void;
  onUpdateLayout: (updates: Partial<PlannerLayoutConfig>) => void;
}

export function PlannerLiveEditor({
  layoutConfig,
  selectedWidgetId,
  onSelectWidget,
  onUpdateWidget,
  onUpdateLayout,
}: PlannerLiveEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { widgets, pageSize, orientation, columns } = layoutConfig;

  // Track selected slot (for empty slots that don't have a widgetId)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  // Clear slot selection when widget is selected
  useEffect(() => {
    if (selectedWidgetId) {
      setSelectedSlotId(null);
    }
  }, [selectedWidgetId]);

  // Load Google Fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Playfair+Display:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Get device preset for dimensions
  const preset = getPresetById(pageSize);
  let deviceWidth = preset?.widthPx ?? 1404;
  let deviceHeight = preset?.heightPx ?? 1872;

  if (orientation === "landscape") {
    [deviceWidth, deviceHeight] = [deviceHeight, deviceWidth];
  }

  // Scale to fit in available space
  const aspectRatio = deviceWidth / deviceHeight;

  // Handle config changes for a specific widget
  const handleConfigChange = useCallback(
    (widgetId: string, config: Record<string, unknown>) => {
      onUpdateWidget(widgetId, { config });
    },
    [onUpdateWidget]
  );

  // Handle section updates from splitter drag
  const handleSectionUpdate = useCallback(
    (sectionId: string, newChildren: LayoutChild[]) => {
      const currentColumns = columns || createEmptyLayout();

      // Deep update the section in the columns structure
      const updateSection = (sections: LayoutSection[]): LayoutSection[] => {
        return sections.map((section) => {
          if (section.id === sectionId) {
            return { ...section, children: newChildren };
          }
          // Recursively check nested sections
          return {
            ...section,
            children: section.children.map((child) => {
              if (child.type === "section" && child.section) {
                const updatedNested = updateSectionRecursive(child.section, sectionId, newChildren);
                return { ...child, section: updatedNested };
              }
              return child;
            }),
          };
        });
      };

      const updateSectionRecursive = (
        section: LayoutSection,
        targetId: string,
        newChildren: LayoutChild[]
      ): LayoutSection => {
        if (section.id === targetId) {
          return { ...section, children: newChildren };
        }
        return {
          ...section,
          children: section.children.map((child) => {
            if (child.type === "section" && child.section) {
              return {
                ...child,
                section: updateSectionRecursive(child.section, targetId, newChildren),
              };
            }
            return child;
          }),
        };
      };

      const updatedSections = updateSection(currentColumns.sections);
      onUpdateLayout({
        columns: { sections: updatedSections },
        layoutMode: "columns",
      });
    },
    [columns, onUpdateLayout]
  );

  // Render a widget with its editable component
  const renderWidget = useCallback(
    (widget: PlannerWidgetInstance, isSelected: boolean) => {
      return renderEditableWidget(
        widget,
        isSelected,
        () => onSelectWidget(widget.id),
        (config) => handleConfigChange(widget.id, config)
      );
    },
    [onSelectWidget, handleConfigChange]
  );

  // Get or generate the root section for rendering
  const rootSection = useMemo(() => {
    if (columns && columns.sections.length > 0) {
      return columns.sections[0];
    }
    // Create empty layout
    return createEmptyLayout().sections[0] || null;
  }, [columns]);

  // State for toolbar add widget modal
  const [showToolbarAddWidget, setShowToolbarAddWidget] = useState(false);

  // Find the selected slot info (works for both widgets and empty slots)
  const selectedSlotInfo = useMemo(() => {
    if ((!selectedWidgetId && !selectedSlotId) || !columns) return null;

    const findSlotInfo = (
      section: LayoutSection,
      parentId: string | null = null
    ): { parentSectionId: string; slotId: string; siblingCount: number } | null => {
      for (const child of section.children) {
        // Match by widget ID (for filled slots)
        if (selectedWidgetId && child.type === "widget" && child.widgetId === selectedWidgetId) {
          return {
            parentSectionId: section.id,
            slotId: child.id,
            siblingCount: section.children.length,
          };
        }
        // Match by slot ID (for empty slots)
        if (selectedSlotId && child.id === selectedSlotId) {
          return {
            parentSectionId: section.id,
            slotId: child.id,
            siblingCount: section.children.length,
          };
        }
        if (child.type === "section" && child.section) {
          const found = findSlotInfo(child.section, section.id);
          if (found) return found;
        }
      }
      return null;
    };

    for (const section of columns.sections) {
      const found = findSlotInfo(section);
      if (found) return found;
    }
    return null;
  }, [selectedWidgetId, selectedSlotId, columns]);

  // Handle selecting an empty slot
  const handleSelectSlot = useCallback((slotId: string | null) => {
    onSelectWidget(null); // Clear widget selection
    setSelectedSlotId(slotId);
  }, [onSelectWidget]);

  // Add a split to a section (horizontal or vertical)
  const handleAddSplit = useCallback(
    (parentSectionId: string, childId: string, direction: "horizontal" | "vertical") => {
      const currentColumns = columns || createEmptyLayout();

      const addSplitToSection = (section: LayoutSection): LayoutSection => {
        if (section.id === parentSectionId) {
          // Find the child and split it
          const newChildren = section.children.flatMap((child) => {
            if (child.id === childId) {
              // Replace this child with two children
              const newId1 = generateId();
              const newId2 = generateId();

              if (direction === section.direction) {
                // Same direction - just add another child at same level
                return [
                  { ...child, flex: child.flex / 2 },
                  { id: newId2, type: "widget" as const, flex: child.flex / 2, widgetId: undefined },
                ];
              } else {
                // Different direction - create a nested section
                return [{
                  id: child.id,
                  type: "section" as const,
                  flex: child.flex,
                  section: {
                    id: `section-${generateId()}`,
                    direction,
                    children: [
                      { id: newId1, type: "widget" as const, flex: 1, widgetId: child.type === "widget" ? child.widgetId : undefined },
                      { id: newId2, type: "widget" as const, flex: 1, widgetId: undefined },
                    ],
                  },
                }];
              }
            }
            // Recursively check nested sections
            if (child.type === "section" && child.section) {
              return [{ ...child, section: addSplitToSection(child.section) }];
            }
            return [child];
          });
          return { ...section, children: newChildren };
        }
        // Recursively search nested sections
        return {
          ...section,
          children: section.children.map((child) => {
            if (child.type === "section" && child.section) {
              return { ...child, section: addSplitToSection(child.section) };
            }
            return child;
          }),
        };
      };

      const updatedSections = currentColumns.sections.map(addSplitToSection);
      onUpdateLayout({
        columns: { sections: updatedSections },
        layoutMode: "columns",
      });
    },
    [columns, onUpdateLayout]
  );

  // Assign a widget to a slot
  const handleAssignWidget = useCallback(
    (slotId: string, widgetId: string) => {
      const currentColumns = columns || createEmptyLayout();

      const assignWidgetInSection = (section: LayoutSection): LayoutSection => {
        return {
          ...section,
          children: section.children.map((child) => {
            if (child.id === slotId && child.type === "widget") {
              return { ...child, widgetId };
            }
            if (child.type === "section" && child.section) {
              return { ...child, section: assignWidgetInSection(child.section) };
            }
            return child;
          }),
        };
      };

      const updatedSections = currentColumns.sections.map(assignWidgetInSection);
      onUpdateLayout({
        columns: { sections: updatedSections },
        layoutMode: "columns",
      });
    },
    [columns, onUpdateLayout]
  );

  // Remove a slot/section
  const handleRemoveSlot = useCallback(
    (parentSectionId: string, childId: string) => {
      const currentColumns = columns || createEmptyLayout();

      const removeFromSection = (section: LayoutSection): LayoutSection => {
        if (section.id === parentSectionId) {
          const newChildren = section.children.filter((child) => child.id !== childId);
          // If only one child left, redistribute flex
          if (newChildren.length === 1 && newChildren[0]) {
            newChildren[0] = { ...newChildren[0], flex: 1 };
          }
          return { ...section, children: newChildren };
        }
        return {
          ...section,
          children: section.children.map((child) => {
            if (child.type === "section" && child.section) {
              return { ...child, section: removeFromSection(child.section) };
            }
            return child;
          }),
        };
      };

      const updatedSections = currentColumns.sections.map(removeFromSection);
      onUpdateLayout({
        columns: { sections: updatedSections },
        layoutMode: "columns",
      });
    },
    [columns, onUpdateLayout]
  );

  // Create a new widget and assign it to a slot
  const handleCreateAndAssignWidget = useCallback(
    (slotId: string, widgetType: PlannerWidgetType) => {
      // 1. Get widget definition from registry
      const definition = PLANNER_WIDGET_REGISTRY[widgetType];

      // 2. Create new widget instance
      const newWidget: PlannerWidgetInstance = {
        id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: widgetType,
        x: 0,
        y: 0,
        width: definition.defaultSize.width,
        height: definition.defaultSize.height,
        config: { ...definition.defaultConfig },
      };

      // 3. Add widget to widgets array
      const newWidgets = [...widgets, newWidget];

      // 4. Assign widget to slot in column layout
      const currentColumns = columns || createEmptyLayout();

      const assignWidgetInSection = (section: LayoutSection): LayoutSection => {
        return {
          ...section,
          children: section.children.map((child) => {
            if (child.id === slotId && child.type === "widget") {
              return { ...child, widgetId: newWidget.id };
            }
            if (child.type === "section" && child.section) {
              return { ...child, section: assignWidgetInSection(child.section) };
            }
            return child;
          }),
        };
      };

      const updatedSections = currentColumns.sections.map(assignWidgetInSection);

      // 5. Update layout with both changes
      onUpdateLayout({
        widgets: newWidgets,
        columns: { sections: updatedSections },
        layoutMode: "columns",
      });

      // 6. Select the new widget
      onSelectWidget(newWidget.id);
    },
    [widgets, columns, onUpdateLayout, onSelectWidget]
  );

  // Add a row above or below a child
  const handleAddRow = useCallback(
    (parentSectionId: string, childId: string, position: "above" | "below") => {
      const currentColumns = columns || createEmptyLayout();
      const newSlotId = generateId();

      const addRowInSection = (section: LayoutSection): LayoutSection => {
        if (section.id === parentSectionId) {
          const childIndex = section.children.findIndex((c) => c.id === childId);
          if (childIndex === -1) return section;

          if (section.direction === "vertical") {
            // Parent is vertical - just insert a new slot
            const newChild: LayoutChild = {
              id: newSlotId,
              type: "widget",
              flex: 1,
              widgetId: undefined,
            };
            const newChildren = [...section.children];
            const insertIndex = position === "above" ? childIndex : childIndex + 1;
            newChildren.splice(insertIndex, 0, newChild);
            return { ...section, children: newChildren };
          } else {
            // Parent is horizontal - wrap entire section in vertical and add row
            const newChild: LayoutChild = {
              id: newSlotId,
              type: "widget",
              flex: 1,
              widgetId: undefined,
            };
            const wrappedSection: LayoutChild = {
              id: generateId(),
              type: "section",
              flex: 3, // Give the existing content more space
              section: { ...section, id: generateId() },
            };

            const newVerticalSection: LayoutSection = {
              id: section.id, // Keep the same ID so references work
              direction: "vertical",
              children: position === "above"
                ? [newChild, wrappedSection]
                : [wrappedSection, newChild],
            };
            return newVerticalSection;
          }
        }

        // Recursively search nested sections
        return {
          ...section,
          children: section.children.map((child) => {
            if (child.type === "section" && child.section) {
              return { ...child, section: addRowInSection(child.section) };
            }
            return child;
          }),
        };
      };

      const updatedSections = currentColumns.sections.map(addRowInSection);
      onUpdateLayout({
        columns: { sections: updatedSections },
        layoutMode: "columns",
      });
    },
    [columns, onUpdateLayout]
  );

  const handleAddRowAbove = useCallback(
    (parentSectionId: string, childId: string) => {
      handleAddRow(parentSectionId, childId, "above");
    },
    [handleAddRow]
  );

  const handleAddRowBelow = useCallback(
    (parentSectionId: string, childId: string) => {
      handleAddRow(parentSectionId, childId, "below");
    },
    [handleAddRow]
  );

  // Distribute evenly - set all children in a section to equal flex
  const handleDistributeEvenly = useCallback(
    (sectionId: string) => {
      const currentColumns = columns || createEmptyLayout();

      const distributeInSection = (section: LayoutSection): LayoutSection => {
        if (section.id === sectionId) {
          return {
            ...section,
            children: section.children.map(child => ({ ...child, flex: 1 }))
          };
        }
        // Recursively check nested sections
        return {
          ...section,
          children: section.children.map(child => {
            if (child.type === "section" && child.section) {
              return { ...child, section: distributeInSection(child.section) };
            }
            return child;
          }),
        };
      };

      const updatedSections = currentColumns.sections.map(distributeInSection);
      onUpdateLayout({
        columns: { sections: updatedSections },
        layoutMode: "columns",
      });
    },
    [columns, onUpdateLayout]
  );

  // Click outside to deselect
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onSelectWidget(null);
        setSelectedSlotId(null);
      }
    },
    [onSelectWidget]
  );

  // Device frame styling based on preset
  const getDeviceFrame = () => {
    const presetId = pageSize;
    if (presetId === "remarkable2") {
      return {
        bezelColor: "#1a1a1a",
        bezelWidth: orientation === "portrait" ? "12px 12px 12px 40px" : "40px 12px 12px 12px",
        borderRadius: 8,
        hasHomeButton: true,
        homeButtonSide: orientation === "portrait" ? "left" : "top",
      };
    }
    if (presetId === "kindle-scribe") {
      return {
        bezelColor: "#2d2d2d",
        bezelWidth: orientation === "portrait" ? "16px 16px 16px 16px" : "16px 16px 16px 16px",
        borderRadius: 12,
        hasHomeButton: false,
        homeButtonSide: null,
      };
    }
    // Default tablet frame
    return {
      bezelColor: "#333",
      bezelWidth: "12px",
      borderRadius: 8,
      hasHomeButton: false,
      homeButtonSide: null,
    };
  };

  const deviceFrame = getDeviceFrame();

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col"
      style={{ backgroundColor: "#d8d4cd", containerType: "size" } as React.CSSProperties}
      onClick={handleContainerClick}
    >
      {/* Toolbar - always visible, buttons disabled when nothing selected */}
      <div className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-white border-b border-gray-200 print:hidden">
        <span className={`text-xs font-medium mr-2 ${selectedSlotInfo ? "text-gray-700" : "text-gray-400"}`}>
          {selectedSlotInfo ? "Actions:" : "Select a widget or slot"}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); if (selectedSlotInfo) handleAddRowAbove(selectedSlotInfo.parentSectionId, selectedSlotInfo.slotId); }}
          disabled={!selectedSlotInfo}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${
            selectedSlotInfo
              ? "text-gray-900 bg-white border-gray-300 hover:bg-gray-100"
              : "text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed"
          }`}
          title="Add row above"
        >
          <ArrowUp className="h-3 w-3" />
          Row Above
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (selectedSlotInfo) handleAddRowBelow(selectedSlotInfo.parentSectionId, selectedSlotInfo.slotId); }}
          disabled={!selectedSlotInfo}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${
            selectedSlotInfo
              ? "text-gray-900 bg-white border-gray-300 hover:bg-gray-100"
              : "text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed"
          }`}
          title="Add row below"
        >
          <ArrowDown className="h-3 w-3" />
          Row Below
        </button>
        <div className="w-px h-4 bg-gray-300" />
        <button
          onClick={(e) => { e.stopPropagation(); if (selectedSlotInfo) handleAddSplit(selectedSlotInfo.parentSectionId, selectedSlotInfo.slotId, "horizontal"); }}
          disabled={!selectedSlotInfo}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${
            selectedSlotInfo
              ? "text-gray-900 bg-white border-gray-300 hover:bg-gray-100"
              : "text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed"
          }`}
          title="Split into columns"
        >
          <Columns className="h-3 w-3" />
          Columns
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (selectedSlotInfo) handleAddSplit(selectedSlotInfo.parentSectionId, selectedSlotInfo.slotId, "vertical"); }}
          disabled={!selectedSlotInfo}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${
            selectedSlotInfo
              ? "text-gray-900 bg-white border-gray-300 hover:bg-gray-100"
              : "text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed"
          }`}
          title="Split into rows"
        >
          <Rows className="h-3 w-3" />
          Rows
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (selectedSlotInfo && selectedSlotInfo.siblingCount > 1) handleDistributeEvenly(selectedSlotInfo.parentSectionId); }}
          disabled={!selectedSlotInfo || selectedSlotInfo.siblingCount <= 1}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${
            selectedSlotInfo && selectedSlotInfo.siblingCount > 1
              ? "text-gray-900 bg-white border-gray-300 hover:bg-gray-100"
              : "text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed"
          }`}
          title="Distribute evenly"
        >
          <Equal className="h-3 w-3" />
          Distribute
        </button>
        <div className="w-px h-4 bg-gray-300" />
        <button
          onClick={(e) => { e.stopPropagation(); if (selectedSlotInfo) setShowToolbarAddWidget(true); }}
          disabled={!selectedSlotInfo}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${
            selectedSlotInfo
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-blue-300 text-blue-100 cursor-not-allowed"
          }`}
          title="Replace widget"
        >
          <Replace className="h-3 w-3" />
          Replace
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (selectedSlotInfo && selectedSlotInfo.siblingCount > 1) handleRemoveSlot(selectedSlotInfo.parentSectionId, selectedSlotInfo.slotId); }}
          disabled={!selectedSlotInfo || selectedSlotInfo.siblingCount <= 1}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${
            selectedSlotInfo && selectedSlotInfo.siblingCount > 1
              ? "bg-white border-red-400 text-red-700 hover:bg-red-50"
              : "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
          }`}
          title="Remove section"
        >
          <X className="h-3 w-3" />
          Remove
        </button>
      </div>

      {/* Preview area - clicking here deselects */}
      <div
        className="flex-1 min-h-0 grid place-items-center"
        style={{ padding: "50px" }}
        onClick={handleContainerClick}
      >
        {/* Screen container - this has the correct aspect ratio */}
        <div
          className="relative print:hidden"
          style={{
            aspectRatio: aspectRatio,
            width: `min(100cqw, ${100 * aspectRatio}cqh)`,
            maxHeight: "100%",
          }}
          onClick={handleContainerClick}
        >
        {/* Device frame - positioned around the screen */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: pageSize === "remarkable2" && orientation === "landscape" ? -40 : -12,
            right: -12,
            bottom: -12,
            left: pageSize === "remarkable2" && orientation === "portrait" ? -40 : -12,
            backgroundColor: deviceFrame.bezelColor,
            borderRadius: deviceFrame.borderRadius + 4,
            boxShadow: `
              0 4px 6px rgba(0,0,0,0.1),
              0 10px 40px rgba(0,0,0,0.2),
              inset 0 1px 0 rgba(255,255,255,0.1)
            `,
          }}
        />

        {/* Home button indicator for reMarkable */}
        {deviceFrame.hasHomeButton && (
          <div
            className="absolute pointer-events-none"
            style={{
              ...(deviceFrame.homeButtonSide === "left" ? {
                left: -30,
                top: "50%",
                transform: "translateY(-50%)",
                width: 16,
                height: 16,
              } : {
                top: -30,
                left: "50%",
                transform: "translateX(-50%)",
                width: 16,
                height: 16,
              }),
              borderRadius: "50%",
              backgroundColor: "#0a0a0a",
              border: "1px solid #333",
              zIndex: 10,
            }}
          />
        )}

        {/* Screen / Planner content */}
        <div
          className="relative overflow-hidden w-full h-full"
          style={{
            backgroundColor: plannerColors.paper,
            borderRadius: 2,
            fontFamily: "'DM Sans', sans-serif",
            color: plannerColors.ink,
            zIndex: 1,
          }}
        >
        {rootSection ? (
          <SplitterContainer
            section={rootSection}
            widgets={widgets}
            selectedWidgetId={selectedWidgetId}
            selectedSlotId={selectedSlotId}
            onSelectWidget={onSelectWidget}
            onSelectSlot={handleSelectSlot}
            onSectionUpdate={handleSectionUpdate}
            onAddSplit={handleAddSplit}
            onAssignWidget={handleAssignWidget}
            onRemoveSlot={handleRemoveSlot}
            onCreateWidget={handleCreateAndAssignWidget}
            onAddRowAbove={handleAddRowAbove}
            onAddRowBelow={handleAddRowBelow}
            onDistributeEvenly={handleDistributeEvenly}
            renderWidget={renderWidget}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center" style={{ color: plannerColors.inkFaint }}>
              <p className="text-lg mb-2">No layout defined</p>
              <p className="text-sm">
                Select a template to get started
              </p>
            </div>
          </div>
        )}
        </div>
      </div>
      </div>

      {/* Toolbar Add Widget Modal */}
      {selectedSlotInfo && (
        <AddWidgetModal
          isOpen={showToolbarAddWidget}
          onClose={() => setShowToolbarAddWidget(false)}
          onSelectWidget={(widgetType) => {
            handleCreateAndAssignWidget(selectedSlotInfo.slotId, widgetType);
            setShowToolbarAddWidget(false);
          }}
        />
      )}
    </div>
  );
}
