import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X, Zap } from "lucide-react";
import { api } from "../../services/api";
import type { ServiceProduct } from "../../services/api";
import { Button } from "../ui/Button";

interface ServicePricingModalProps {
  /** Which service the user is trying to connect (e.g., "weather", "traffic", "ai") */
  serviceType: "weather" | "traffic" | "ai";
  onClose: () => void;
  /** Called when user chooses "Use your own API key" instead */
  onUseOwnKey: () => void;
}

export function ServicePricingModal({
  serviceType,
  onClose,
  onUseOwnKey,
}: ServicePricingModalProps) {
  const queryClient = useQueryClient();
  const [subscribing, setSubscribing] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["serviceProducts"],
    queryFn: () => api.getServiceProducts(),
  });

  const subscribeMutation = useMutation({
    mutationFn: (serviceProductId: string) =>
      api.subscribeToService(serviceProductId),
    onSuccess: (result, serviceProductId) => {
      if (result.data?.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = result.data.checkoutUrl;
        return;
      }
      // Already subscribed or instant subscription via existing Stripe sub
      queryClient.invalidateQueries({ queryKey: ["serviceProducts"] });
      queryClient.invalidateQueries({ queryKey: ["billingInfo"] });
      setSubscribing(null);
      onClose();
    },
    onError: () => {
      setSubscribing(null);
    },
  });

  const activeSubscriptionIds = new Set(
    data?.subscriptions
      .filter((s) => s.status === "active")
      .map((s) => s.serviceProductId) || []
  );

  // Determine which products are relevant to this service type
  const serviceFilter: Record<string, string[]> = {
    weather: ["weather"],
    traffic: ["traffic"],
    ai: ["ai_throttled"],
  };
  const relevantFeatures = serviceFilter[serviceType] || [];

  // Filter products: show individual for this service + bundles that include it
  const relevantProducts = (data?.products || []).filter((p) => {
    if (p.type === "individual") {
      return p.includedServices.some((s) => relevantFeatures.includes(s) || s === serviceType);
    }
    // Show bundles that include this service
    return p.includedServices.includes(serviceType) || p.features.some((f) => relevantFeatures.includes(f));
  });

  // Check if already subscribed to any product that covers this service
  const isAlreadyCovered = (data?.products || []).some((p) => {
    if (!activeSubscriptionIds.has(p.id)) return false;
    return p.includedServices.includes(serviceType) || p.features.some((f) => relevantFeatures.includes(f));
  });

  function handleSubscribe(productId: string) {
    setSubscribing(productId);
    subscribeMutation.mutate(productId);
  }

  const serviceLabels: Record<string, string> = {
    weather: "Weather",
    traffic: "Traffic",
    ai: "AI",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-primary">
              Connect {serviceLabels[serviceType]}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose how to connect your {(serviceLabels[serviceType] ?? serviceType).toLowerCase()} service
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Option 1: Use Your Own API Key */}
          <div
            onClick={onUseOwnKey}
            className="border border-border rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-primary">Use Your Own API Key</h3>
                <p className="text-sm text-muted-foreground">
                  Configure with your own {serviceType === "weather" ? "OpenWeatherMap" : serviceType === "traffic" ? "Google Maps" : "AI provider"} API key
                </p>
              </div>
              <span className="ml-auto text-xs font-medium text-muted-foreground bg-primary/5 px-2 py-1 rounded">
                Free
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              or use OpenFrame Premium
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Premium Service Options */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : isAlreadyCovered ? (
            <div className="border border-green-600/30 bg-green-600/5 rounded-xl p-4 flex items-center gap-3">
              <Check className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-primary">Premium {serviceLabels[serviceType]} Active</p>
                <p className="text-sm text-muted-foreground">
                  You have an active subscription that includes this service.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {relevantProducts.map((product) => (
                <ServiceProductCard
                  key={product.id}
                  product={product}
                  isActive={activeSubscriptionIds.has(product.id)}
                  isSubscribing={subscribing === product.id}
                  onSubscribe={() => handleSubscribe(product.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ServiceProductCard({
  product,
  isActive,
  isSubscribing,
  onSubscribe,
}: {
  product: ServiceProduct;
  isActive: boolean;
  isSubscribing: boolean;
  onSubscribe: () => void;
}) {
  const priceStr = `$${(product.monthlyPrice / 100).toFixed(2)}`;
  const isBundle = product.type === "bundle";
  const isPremium = product.id === "premium_bundle";

  return (
    <div
      className={`border rounded-xl p-4 transition-colors ${
        isPremium
          ? "border-primary/50 bg-primary/5"
          : "border-border hover:border-primary/30"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-primary">{product.name}</h3>
            {isPremium && (
              <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                <Zap className="w-3 h-3" /> Best Value
              </span>
            )}
            {isBundle && !isPremium && (
              <span className="text-xs font-medium text-muted-foreground bg-primary/5 px-2 py-0.5 rounded-full">
                Bundle
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {product.description}
          </p>
          {isBundle && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {product.includedServices.map((svc) => (
                <span
                  key={svc}
                  className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize"
                >
                  {svc === "ai_throttled" ? "AI (250K tokens/mo)" : svc}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 ml-4">
          <div className="text-right">
            <span className="text-xl font-bold text-primary">{priceStr}</span>
            <span className="text-xs text-muted-foreground">/mo</span>
          </div>
          {isActive ? (
            <span className="flex items-center gap-1 text-xs font-medium text-green-600">
              <Check className="w-3 h-3" /> Active
            </span>
          ) : (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onSubscribe();
              }}
              disabled={isSubscribing}
              className="text-sm px-4 py-1.5"
            >
              {isSubscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Subscribe"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
