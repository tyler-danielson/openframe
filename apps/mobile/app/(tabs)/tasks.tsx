import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { api } from "../../services/api";
import { useThemeColors } from "../../hooks/useColorScheme";
import type { Task, TaskList } from "@openframe/shared";

function formatDueDate(dueDate: Date | string | null): string | null {
  if (!dueDate) return null;
  const d = typeof dueDate === "string" ? parseISO(dueDate) : dueDate;
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "MMM d");
}

function isDueOverdue(dueDate: Date | string | null): boolean {
  if (!dueDate) return false;
  const d = typeof dueDate === "string" ? parseISO(dueDate) : dueDate;
  return isPast(d) && !isToday(d);
}

export default function TasksScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();

  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showInput, setShowInput] = useState(false);

  const { data: taskLists } = useQuery({
    queryKey: ["taskLists"],
    queryFn: () => api.getTaskLists(),
  });

  const {
    data: tasks,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["tasks", selectedListId, showCompleted ? "all" : "needsAction"],
    queryFn: () =>
      api.getTasks({
        listId: selectedListId ?? undefined,
        status: showCompleted ? undefined : "needsAction",
      }),
  });

  const completeTask = useMutation({
    mutationFn: (id: string) => api.completeTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const createTask = useMutation({
    mutationFn: (data: { taskListId: string; title: string }) =>
      api.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setNewTaskTitle("");
      setShowInput(false);
    },
  });

  const handleCreate = useCallback(() => {
    const title = newTaskTitle.trim();
    if (!title) return;

    const listId = selectedListId || taskLists?.[0]?.id;
    if (!listId) {
      Alert.alert("No Task List", "No task lists available.");
      return;
    }

    createTask.mutate({ taskListId: listId, title });
  }, [newTaskTitle, selectedListId, taskLists, createTask]);

  const handleComplete = useCallback(
    (task: Task) => {
      if (task.status === "completed") return;
      completeTask.mutate(task.id);
    },
    [completeTask]
  );

  const pendingTasks = tasks?.filter((t) => t.status === "needsAction") ?? [];
  const completedTasks = tasks?.filter((t) => t.status === "completed") ?? [];

  const renderTask = ({ item }: { item: Task }) => {
    const isCompleted = item.status === "completed";
    const dueDateStr = formatDueDate(item.dueDate);
    const overdue = !isCompleted && isDueOverdue(item.dueDate);

    return (
      <TouchableOpacity
        onPress={() => handleComplete(item)}
        disabled={isCompleted}
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ marginRight: 12, marginTop: 2 }}>
          {isCompleted ? (
            <Ionicons
              name="checkmark-circle"
              size={22}
              color={colors.primary}
            />
          ) : completeTask.isPending &&
            completeTask.variables === item.id ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons
              name="ellipse-outline"
              size={22}
              color={colors.mutedForeground}
            />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: isCompleted
                ? colors.mutedForeground
                : colors.foreground,
              fontSize: 15,
              textDecorationLine: isCompleted ? "line-through" : "none",
            }}
          >
            {item.title}
          </Text>
          {item.notes ? (
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 13,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {item.notes}
            </Text>
          ) : null}
          {dueDateStr ? (
            <Text
              style={{
                color: overdue ? "#EF4444" : colors.mutedForeground,
                fontSize: 12,
                marginTop: 4,
                fontWeight: overdue ? "600" : "400",
              }}
            >
              {overdue ? "Overdue · " : ""}
              {dueDateStr}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const sections: Task[] = [
    ...pendingTasks,
    ...(showCompleted ? completedTasks : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Task list filter chips */}
      {taskLists && taskLists.length > 1 && (
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            gap: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => setSelectedListId(null)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor:
                selectedListId === null ? colors.primary : colors.card,
              borderWidth: 1,
              borderColor:
                selectedListId === null ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                color: selectedListId === null ? "#FFF" : colors.foreground,
                fontSize: 13,
                fontWeight: "500",
              }}
            >
              All
            </Text>
          </TouchableOpacity>
          {taskLists.map((list) => (
            <TouchableOpacity
              key={list.id}
              onPress={() => setSelectedListId(list.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor:
                  selectedListId === list.id ? colors.primary : colors.card,
                borderWidth: 1,
                borderColor:
                  selectedListId === list.id ? colors.primary : colors.border,
              }}
            >
              <Text
                style={{
                  color:
                    selectedListId === list.id ? "#FFF" : colors.foreground,
                  fontSize: 13,
                  fontWeight: "500",
                }}
                numberOfLines={1}
              >
                {list.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* New task input */}
      {showInput && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            gap: 8,
          }}
        >
          <Ionicons
            name="ellipse-outline"
            size={22}
            color={colors.mutedForeground}
          />
          <TextInput
            style={{
              flex: 1,
              color: colors.foreground,
              fontSize: 15,
              padding: 10,
              backgroundColor: colors.card,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            placeholder="New task..."
            placeholderTextColor={colors.mutedForeground}
            value={newTaskTitle}
            onChangeText={setNewTaskTitle}
            autoFocus
            onSubmitEditing={handleCreate}
            returnKeyType="done"
          />
          <TouchableOpacity
            onPress={handleCreate}
            disabled={createTask.isPending || !newTaskTitle.trim()}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 8,
              opacity: !newTaskTitle.trim() ? 0.5 : 1,
            }}
          >
            {createTask.isPending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={{ color: "#FFF", fontWeight: "600" }}>Add</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowInput(false)}>
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* Task list */}
      <FlatList
        data={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderTask}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListFooterComponent={
          completedTasks.length > 0 ? (
            <TouchableOpacity
              onPress={() => setShowCompleted(!showCompleted)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                gap: 8,
              }}
            >
              <Ionicons
                name={showCompleted ? "chevron-down" : "chevron-forward"}
                size={18}
                color={colors.mutedForeground}
              />
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                }}
              >
                {completedTasks.length} completed
              </Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 80,
              }}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={64}
                color={colors.mutedForeground}
              />
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 16,
                  marginTop: 12,
                }}
              >
                {showCompleted ? "No tasks" : "All caught up!"}
              </Text>
              <TouchableOpacity
                onPress={() => setShowInput(true)}
                style={{
                  marginTop: 16,
                  backgroundColor: colors.primary,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#FFF", fontWeight: "600" }}>
                  Add a Task
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* FAB */}
      {!showInput && (
        <TouchableOpacity
          style={{
            position: "absolute",
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            elevation: 8,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          }}
          onPress={() => setShowInput(true)}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}
