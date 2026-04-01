import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../hooks/useColorScheme";
import { api, type JoinRequest } from "../../services/api";

export default function JoinRequestsScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const { data: invites, isLoading, refetch } = useQuery({
    queryKey: ["companion-invites"],
    queryFn: () => api.getCompanionInvites(),
  });

  const createInvite = useMutation({
    mutationFn: (label?: string) => api.createCompanionInvite(label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-invites"] });
      setShowCreate(false);
      setNewLabel("");
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message ?? "Failed to create invite");
    },
  });

  const deleteInvite = useMutation({
    mutationFn: (id: string) => api.deleteCompanionInvite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-invites"] });
    },
  });

  const handleDelete = (invite: JoinRequest) => {
    Alert.alert("Delete Invite", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteInvite.mutate(invite.id) },
    ]);
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      {/* Create button / form */}
      {showCreate ? (
        <View className="bg-card rounded-xl p-4 mb-6">
          <Text className="text-foreground font-medium mb-2">New Invite</Text>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 mb-3 text-foreground"
            style={{ color: colors.foreground }}
            placeholder="Label (optional)"
            placeholderTextColor={colors.mutedForeground}
            value={newLabel}
            onChangeText={setNewLabel}
          />
          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-secondary rounded-xl py-3 items-center"
              onPress={() => { setShowCreate(false); setNewLabel(""); }}
            >
              <Text className="text-foreground font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-primary rounded-xl py-3 items-center"
              onPress={() => createInvite.mutate(newLabel || undefined)}
              disabled={createInvite.isPending}
            >
              {createInvite.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-white font-medium">Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          className="bg-card border border-dashed border-border rounded-xl p-4 flex-row items-center justify-center mb-6"
          onPress={() => setShowCreate(true)}
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <Text className="text-primary font-medium ml-2">Create Invite</Text>
        </TouchableOpacity>
      )}

      {/* Invites list */}
      {(!invites || invites.length === 0) && !isLoading ? (
        <View className="items-center py-12">
          <Ionicons name="person-add-outline" size={48} color={colors.mutedForeground} />
          <Text className="text-muted-foreground mt-4 text-center">
            No invites. Create an invite link to share with family members.
          </Text>
        </View>
      ) : (
        <View className="bg-card rounded-xl overflow-hidden">
          {invites?.map((invite, index) => (
            <View
              key={invite.id}
              className={`px-4 py-3 ${
                index < (invites?.length ?? 0) - 1 ? "border-b border-border" : ""
              }`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-foreground font-medium">
                    {invite.label || "Unnamed Invite"}
                  </Text>
                  {invite.token && (
                    <Text className="text-muted-foreground text-xs mt-0.5">
                      Token: {invite.token.slice(0, 8)}...
                    </Text>
                  )}
                  {invite.expiresAt && (
                    <Text className="text-muted-foreground text-xs mt-0.5">
                      Expires: {new Date(invite.expiresAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleDelete(invite)} className="p-2">
                  <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
