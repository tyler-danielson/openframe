import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../services/api";
import { useThemeColors } from "../../hooks/useColorScheme";
import type { Photo } from "@openframe/shared";

const SCREEN_WIDTH = Dimensions.get("window").width;
const COLUMNS = 3;
const GAP = 2;
const TILE_SIZE = (SCREEN_WIDTH - GAP * (COLUMNS + 1)) / COLUMNS;

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [viewerPhoto, setViewerPhoto] = useState<Photo | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: albums } = useQuery({
    queryKey: ["albums"],
    queryFn: () => api.getAlbums(),
  });
  const album = albums?.find((a) => a.id === id);

  const {
    data: photos,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["album-photos", id],
    queryFn: () => api.getAlbumPhotos(id),
    enabled: !!id,
  });

  const deletePhoto = useMutation({
    mutationFn: (photoId: string) => api.deletePhoto(photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["album-photos", id] });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      setViewerPhoto(null);
    },
  });

  const handlePickPhotos = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.9,
    });

    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    let uploaded = 0;
    const total = result.assets.length;

    for (const asset of result.assets) {
      try {
        const filename =
          asset.fileName || `photo_${Date.now()}.jpg`;
        const mimeType = asset.mimeType || "image/jpeg";
        await api.uploadPhoto(id, asset.uri, filename, mimeType);
        uploaded++;
      } catch (e) {
        console.warn("Upload failed for", asset.uri, e);
      }
    }

    setUploading(false);
    queryClient.invalidateQueries({ queryKey: ["album-photos", id] });
    queryClient.invalidateQueries({ queryKey: ["albums"] });

    if (uploaded < total) {
      Alert.alert("Upload", `${uploaded}/${total} photos uploaded`);
    }
  }, [id, queryClient]);

  const handleTakePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Camera access is needed to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
    });

    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      await api.uploadPhoto(
        id,
        asset.uri,
        asset.fileName || `photo_${Date.now()}.jpg`,
        asset.mimeType || "image/jpeg"
      );
      queryClient.invalidateQueries({ queryKey: ["album-photos", id] });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
    } catch {
      Alert.alert("Error", "Failed to upload photo");
    }
    setUploading(false);
  }, [id, queryClient]);

  const handleDeletePhoto = (photo: Photo) => {
    Alert.alert("Delete Photo", "Delete this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deletePhoto.mutate(photo.id),
      },
    ]);
  };

  const currentIndex = viewerPhoto
    ? photos?.findIndex((p) => p.id === viewerPhoto.id) ?? -1
    : -1;

  const navigateViewer = (dir: -1 | 1) => {
    if (!photos || currentIndex < 0) return;
    const next = currentIndex + dir;
    if (next >= 0 && next < photos.length) {
      setViewerPhoto(photos[next]);
    }
  };

  const renderPhoto = ({ item }: { item: Photo }) => {
    const url = api.getPhotoUrl(item.thumbnailUrl || item.originalUrl);
    return (
      <TouchableOpacity
        onPress={() => setViewerPhoto(item)}
        style={{ width: TILE_SIZE, height: TILE_SIZE, padding: GAP / 2 }}
      >
        {url ? (
          <Image
            source={{ uri: url }}
            style={{ flex: 1, borderRadius: 2, backgroundColor: colors.card }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              flex: 1,
              borderRadius: 2,
              backgroundColor: colors.card,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="image" size={24} color={colors.mutedForeground} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 18,
            fontWeight: "600",
            marginLeft: 12,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {album?.name || "Album"}
        </Text>
        {uploading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      {/* Photo grid */}
      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        renderItem={renderPhoto}
        numColumns={COLUMNS}
        contentContainerStyle={{ paddingVertical: GAP }}
        refreshing={isLoading}
        onRefresh={refetch}
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
                name="camera-outline"
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
                No photos yet
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                  marginTop: 4,
                }}
              >
                Tap + to add photos
              </Text>
            </View>
          ) : null
        }
      />

      {/* Upload FAB */}
      <View
        style={{
          position: "absolute",
          bottom: insets.bottom + 16,
          right: 16,
          gap: 12,
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={handleTakePhoto}
          disabled={uploading}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            elevation: 4,
          }}
        >
          <Ionicons name="camera" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handlePickPhotos}
          disabled={uploading}
          style={{
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
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Photo Viewer Modal */}
      <Modal
        visible={!!viewerPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerPhoto(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#000",
          }}
        >
          {/* Viewer header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: insets.top + 8,
              paddingHorizontal: 16,
              paddingBottom: 8,
            }}
          >
            <TouchableOpacity onPress={() => setViewerPhoto(null)}>
              <Ionicons name="close" size={26} color="#FFF" />
            </TouchableOpacity>
            <Text style={{ color: "#FFF9", fontSize: 14 }}>
              {currentIndex >= 0 && photos
                ? `${currentIndex + 1} / ${photos.length}`
                : ""}
            </Text>
            <TouchableOpacity
              onPress={() => viewerPhoto && handleDeletePhoto(viewerPhoto)}
            >
              <Ionicons name="trash-outline" size={22} color="#FFF9" />
            </TouchableOpacity>
          </View>

          {/* Image */}
          {viewerPhoto && (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Image
                source={{
                  uri:
                    api.getPhotoUrl(
                      viewerPhoto.mediumUrl || viewerPhoto.originalUrl
                    ) || undefined,
                }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Nav arrows */}
          <View
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              flexDirection: "row",
              justifyContent: "space-between",
              paddingHorizontal: 8,
            }}
          >
            <TouchableOpacity
              onPress={() => navigateViewer(-1)}
              style={{ opacity: currentIndex > 0 ? 1 : 0.2, padding: 12 }}
              disabled={currentIndex <= 0}
            >
              <Ionicons name="chevron-back" size={32} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigateViewer(1)}
              style={{
                opacity:
                  photos && currentIndex < photos.length - 1 ? 1 : 0.2,
                padding: 12,
              }}
              disabled={!photos || currentIndex >= photos.length - 1}
            >
              <Ionicons name="chevron-forward" size={32} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Photo info */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 12,
              paddingTop: 8,
            }}
          >
            {viewerPhoto?.originalFilename && (
              <Text style={{ color: "#FFF9", fontSize: 13 }}>
                {viewerPhoto.originalFilename}
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
