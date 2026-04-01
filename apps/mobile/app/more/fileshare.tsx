import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useThemeColors } from "../../hooks/useColorScheme";
import { api, type SharedFile } from "../../services/api";

const FILE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  "image/": "image-outline",
  "video/": "videocam-outline",
  "audio/": "musical-note-outline",
  "application/pdf": "document-text-outline",
  "text/": "document-outline",
};

function getFileIcon(mimeType: string): keyof typeof Ionicons.glyphMap {
  for (const [prefix, icon] of Object.entries(FILE_ICONS)) {
    if (mimeType.startsWith(prefix)) return icon;
  }
  return "document-outline";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function FileShareScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();

  const { data: files, isLoading, refetch } = useQuery({
    queryKey: ["shared-files"],
    queryFn: () => api.getSharedFiles(),
    staleTime: 60 * 1000,
  });

  const uploadFile = useMutation({
    mutationFn: async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      return api.uploadSharedFile(
        asset.uri,
        asset.name ?? "file",
        asset.mimeType ?? "application/octet-stream"
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-files"] });
    },
    onError: (error: any) => {
      Alert.alert("Upload Failed", error.message ?? "Failed to upload file");
    },
  });

  const deleteFile = useMutation({
    mutationFn: (id: string) => api.deleteSharedFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-files"] });
    },
  });

  const handleDelete = (file: SharedFile) => {
    Alert.alert("Delete File", `Delete "${file.filename}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteFile.mutate(file.id) },
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
      {/* Upload button */}
      <TouchableOpacity
        className="bg-card border border-dashed border-border rounded-xl p-4 flex-row items-center justify-center mb-6"
        onPress={() => uploadFile.mutate()}
        disabled={uploadFile.isPending}
      >
        {uploadFile.isPending ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
            <Text className="text-primary font-medium ml-2">Upload File</Text>
          </>
        )}
      </TouchableOpacity>

      {/* File list */}
      {(!files || files.length === 0) && !isLoading ? (
        <View className="items-center py-12">
          <Ionicons name="folder-open-outline" size={48} color={colors.mutedForeground} />
          <Text className="text-muted-foreground mt-4 text-center">
            No shared files. Upload photos or documents to share with your displays.
          </Text>
        </View>
      ) : (
        <View className="bg-card rounded-xl overflow-hidden">
          {files?.map((file, index) => (
            <TouchableOpacity
              key={file.id}
              className={`flex-row items-center px-4 py-3 ${
                index < (files?.length ?? 0) - 1 ? "border-b border-border" : ""
              }`}
              onLongPress={() => handleDelete(file)}
            >
              <View
                className="w-10 h-10 rounded-lg items-center justify-center mr-3"
                style={{ backgroundColor: colors.primary + "15" }}
              >
                <Ionicons name={getFileIcon(file.mimeType)} size={20} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground" numberOfLines={1}>{file.filename}</Text>
                <Text className="text-muted-foreground text-xs">
                  {formatFileSize(file.size)} · {new Date(file.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(file)} className="p-2">
                <Ionicons name="trash-outline" size={18} color={colors.destructive} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
