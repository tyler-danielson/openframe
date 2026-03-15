import { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useThemeColors } from "../../hooks/useColorScheme";
import type { PhotoAlbum, Photo } from "@openframe/shared";

function AlbumCover({ albumId, colors }: { albumId: string; colors: ReturnType<typeof useThemeColors> }) {
  const { data: photos } = useQuery({
    queryKey: ["album-photos", albumId],
    queryFn: () => api.getAlbumPhotos(albumId),
    staleTime: 10 * 60 * 1000,
  });

  const gridPhotos = useMemo(() => {
    if (!photos || photos.length === 0) return [];
    if (photos.length <= 4) return photos.slice(0, 4);
    // Pick 4 random photos (stable per render)
    const shuffled = [...photos].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 4);
  }, [photos]);

  if (gridPhotos.length === 0) {
    return (
      <View
        style={{
          aspectRatio: 1,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="images" size={40} color={colors.mutedForeground} />
      </View>
    );
  }

  return (
    <View style={{ aspectRatio: 1, flexDirection: "row", flexWrap: "wrap" }}>
      {[0, 1, 2, 3].map((i) => {
        const photo = gridPhotos[i % gridPhotos.length];
        const url = api.getPhotoUrl(photo?.thumbnailUrl || photo?.originalUrl);
        return (
          <View key={i} style={{ width: "50%", height: "50%", padding: 0.5 }}>
            {url ? (
              <Image
                source={{ uri: url }}
                style={{ flex: 1, backgroundColor: colors.card }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: colors.card }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function PhotosScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");

  const {
    data: albums,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["albums"],
    queryFn: () => api.getAlbums(),
  });

  const createAlbum = useMutation({
    mutationFn: (name: string) => api.createAlbum({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      setNewAlbumName("");
      setShowCreate(false);
    },
  });

  const deleteAlbum = useMutation({
    mutationFn: (id: string) => api.deleteAlbum(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["albums"] }),
  });

  const handleCreate = () => {
    const name = newAlbumName.trim();
    if (!name) return;
    createAlbum.mutate(name);
  };

  const handleDelete = (album: PhotoAlbum) => {
    Alert.alert(
      "Delete Album",
      `Delete "${album.name}" and all its photos?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteAlbum.mutate(album.id),
        },
      ]
    );
  };

  const renderAlbum = ({ item }: { item: PhotoAlbum }) => (
    <TouchableOpacity
      onPress={() => router.push(`/album/${item.id}`)}
      onLongPress={() => handleDelete(item)}
      style={{
        flex: 1,
        margin: 6,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <AlbumCover albumId={item.id} colors={colors} />
      <View style={{ padding: 10 }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 14,
            fontWeight: "600",
          }}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            marginTop: 2,
          }}
        >
          {item.photoCount ?? 0} photos
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Create album input */}
      {showCreate && (
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
            placeholder="Album name"
            placeholderTextColor={colors.mutedForeground}
            value={newAlbumName}
            onChangeText={setNewAlbumName}
            autoFocus
            onSubmitEditing={handleCreate}
            returnKeyType="done"
          />
          <TouchableOpacity
            onPress={handleCreate}
            disabled={createAlbum.isPending || !newAlbumName.trim()}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 8,
              opacity: !newAlbumName.trim() ? 0.5 : 1,
            }}
          >
            {createAlbum.isPending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={{ color: "#FFF", fontWeight: "600" }}>Create</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowCreate(false)}>
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={albums}
        keyExtractor={(item) => item.id}
        renderItem={renderAlbum}
        numColumns={2}
        contentContainerStyle={{ padding: 6 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
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
                name="images-outline"
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
                No photo albums yet
              </Text>
              <TouchableOpacity
                onPress={() => setShowCreate(true)}
                style={{
                  marginTop: 16,
                  backgroundColor: colors.primary,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#FFF", fontWeight: "600" }}>
                  Create Album
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* FAB */}
      {!showCreate && (
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
          onPress={() => setShowCreate(true)}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}
