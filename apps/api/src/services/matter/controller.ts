/**
 * Matter Controller Service
 *
 * Uses @matter/main ServerNode as a controller to commission and control
 * Matter devices via the Peers API.
 *
 * The ServerNode automatically includes ControllerBehavior which enables
 * the `peers` property for discovering, commissioning, and interacting
 * with remote Matter devices.
 */

import { Environment, StorageService, ServerNode } from "@matter/main";
import type {
  MatterDeviceType,
  MatterDeviceState,
  MatterDeviceAttributes,
} from "@openframe/shared";
import { resolve } from "path";

// Device type IDs from the Matter spec
const DEVICE_TYPE_MAP: Record<number, MatterDeviceType> = {
  0x0100: "onOffLight",
  0x0101: "dimmableLight",
  0x0102: "colorTemperatureLight",
  0x0301: "thermostat",
  0x000a: "doorLock",
  0x0015: "contactSensor",
  0x0107: "occupancySensor",
  0x0302: "temperatureSensor",
  0x0307: "humiditySensor",
  0x0103: "onOffSwitch",
  0x0202: "windowCovering",
  0x002b: "fan",
};

export interface CommissionResult {
  nodeId: string;
  vendorName: string | null;
  productName: string | null;
  deviceType: MatterDeviceType;
}

export class MatterControllerService {
  private serverNode: InstanceType<typeof ServerNode<any>> | null = null;
  private _initialized = false;
  private storagePath: string;

  constructor(storagePath?: string) {
    this.storagePath = storagePath ?? resolve(process.cwd(), "data", ".matter");
  }

  async initialize(): Promise<void> {
    try {
      const environment = Environment.default;

      // Configure storage location for Matter fabric data
      const storage = environment.get(StorageService);
      storage.location = this.storagePath;

      // Create a ServerNode which automatically includes ControllerBehavior
      // This enables the peers API for commissioning and controlling devices
      this.serverNode = await ServerNode.create() as any;
      await this.serverNode!.start();

      this._initialized = true;
    } catch (error) {
      this._initialized = false;
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.serverNode) {
      await this.serverNode.close();
      this.serverNode = null;
    }
    this._initialized = false;
  }

  isInitialized(): boolean {
    return this._initialized && this.serverNode !== null;
  }

  /**
   * Commission (pair) a new Matter device using a pairing code.
   * Accepts both manual codes (11/21-digit numbers) and QR strings (MT:...).
   */
  async commissionDevice(pairingCode: string): Promise<CommissionResult> {
    if (!this.serverNode) {
      throw new Error("Matter controller not initialized");
    }

    const trimmedCode = pairingCode.trim();
    const peers = (this.serverNode as any).peers;

    if (!peers?.commission) {
      throw new Error("Peers API not available on server node");
    }

    // Use peers.commission() which accepts PairingCodeOptions
    // This handles discovery + commissioning in one step
    const discovery = peers.commission({ pairingCode: trimmedCode });
    await discovery.settle();

    // Get the commissioned client node
    const clientNode = discovery.node ?? discovery.result;
    if (!clientNode) {
      throw new Error("Commissioning completed but no node was returned");
    }

    const nodeId = String(clientNode.id ?? clientNode.nodeId ?? "unknown");

    // Detect device type and basic info from commissioning state
    let deviceType: MatterDeviceType = "unknown";
    let vendorName: string | null = null;
    let productName: string | null = null;

    try {
      const commState = clientNode.state?.commissioning;
      if (commState) {
        if (commState.vendorId) {
          vendorName = `Vendor ${commState.vendorId}`;
        }
        productName = commState.deviceName ?? null;
        if (commState.deviceType != null) {
          deviceType = DEVICE_TYPE_MAP[Number(commState.deviceType)] ?? "unknown";
        }
      }
    } catch {
      // Non-fatal — device info detection failed
    }

    return { nodeId, vendorName, productName, deviceType };
  }

  /**
   * Decommission (unpair) a device from the controller fabric.
   */
  async decommissionDevice(nodeId: string): Promise<void> {
    if (!this.serverNode) {
      throw new Error("Matter controller not initialized");
    }

    const peers = (this.serverNode as any).peers;
    const clientNode = peers?.get?.(nodeId);

    if (clientNode) {
      if (typeof clientNode.decommission === "function") {
        await clientNode.decommission();
      } else if (typeof clientNode.delete === "function") {
        await clientNode.delete();
      }
    }
  }

  /**
   * Read current state/attributes from a commissioned device.
   */
  async getDeviceState(nodeId: string): Promise<MatterDeviceState> {
    if (!this.serverNode) {
      throw new Error("Matter controller not initialized");
    }

    const peers = (this.serverNode as any).peers;
    const clientNode = peers?.get?.(nodeId);

    if (!clientNode) {
      return {
        nodeId,
        deviceType: "unknown",
        isReachable: false,
        attributes: {},
      };
    }

    const attributes: MatterDeviceAttributes = {};
    let deviceType: MatterDeviceType = "unknown";
    let isReachable = false;

    try {
      // Use act() to interact with the remote node's endpoints
      if (typeof clientNode.act === "function") {
        await clientNode.act(async (agent: any) => {
          isReachable = true;

          // Detect device type from Descriptor cluster
          try {
            const descriptor = agent.descriptor ?? agent.get?.("Descriptor");
            if (descriptor) {
              const dtList =
                descriptor.state?.deviceTypeList ??
                (await descriptor.attributes?.deviceTypeList?.get?.());
              if (dtList?.length > 0) {
                deviceType =
                  DEVICE_TYPE_MAP[dtList[0].deviceType] ?? "unknown";
              }
            }
          } catch {
            /* non-fatal */
          }

          // OnOff cluster
          try {
            const onOff = agent.onOff ?? agent.get?.("OnOff");
            if (onOff) {
              attributes.onOff =
                onOff.state?.onOff ??
                (await onOff.attributes?.onOff?.get?.());
            }
          } catch {
            /* non-fatal */
          }

          // LevelControl cluster
          try {
            const level =
              agent.levelControl ?? agent.get?.("LevelControl");
            if (level) {
              attributes.currentLevel =
                level.state?.currentLevel ??
                (await level.attributes?.currentLevel?.get?.());
            }
          } catch {
            /* non-fatal */
          }

          // ColorControl cluster
          try {
            const color =
              agent.colorControl ?? agent.get?.("ColorControl");
            if (color) {
              attributes.colorTemperatureMireds =
                color.state?.colorTemperatureMireds ??
                (await color.attributes?.colorTemperatureMireds?.get?.());
            }
          } catch {
            /* non-fatal */
          }

          // Thermostat cluster
          try {
            const therm = agent.thermostat ?? agent.get?.("Thermostat");
            if (therm) {
              const s = therm.state ?? {};
              attributes.localTemperature = s.localTemperature;
              attributes.occupiedHeatingSetpoint = s.occupiedHeatingSetpoint;
              attributes.occupiedCoolingSetpoint = s.occupiedCoolingSetpoint;
              attributes.systemMode = s.systemMode;
            }
          } catch {
            /* non-fatal */
          }

          // DoorLock cluster
          try {
            const lock = agent.doorLock ?? agent.get?.("DoorLock");
            if (lock) {
              attributes.lockState =
                lock.state?.lockState ??
                (await lock.attributes?.lockState?.get?.());
            }
          } catch {
            /* non-fatal */
          }

          // BooleanState cluster (contact sensors)
          try {
            const bool =
              agent.booleanState ?? agent.get?.("BooleanState");
            if (bool) {
              attributes.contactState =
                bool.state?.stateValue ??
                (await bool.attributes?.stateValue?.get?.());
            }
          } catch {
            /* non-fatal */
          }

          // OccupancySensing cluster
          try {
            const occ =
              agent.occupancySensing ?? agent.get?.("OccupancySensing");
            if (occ) {
              const val =
                occ.state?.occupancy ??
                (await occ.attributes?.occupancy?.get?.());
              attributes.occupancy = (val & 0x01) === 1;
            }
          } catch {
            /* non-fatal */
          }

          // TemperatureMeasurement cluster
          try {
            const temp =
              agent.temperatureMeasurement ??
              agent.get?.("TemperatureMeasurement");
            if (temp) {
              attributes.measuredTemperature =
                temp.state?.measuredValue ??
                (await temp.attributes?.measuredValue?.get?.());
            }
          } catch {
            /* non-fatal */
          }

          // RelativeHumidityMeasurement cluster
          try {
            const hum =
              agent.relativeHumidityMeasurement ??
              agent.get?.("RelativeHumidityMeasurement");
            if (hum) {
              attributes.measuredHumidity =
                hum.state?.measuredValue ??
                (await hum.attributes?.measuredValue?.get?.());
            }
          } catch {
            /* non-fatal */
          }

          // WindowCovering cluster
          try {
            const wc =
              agent.windowCovering ?? agent.get?.("WindowCovering");
            if (wc) {
              attributes.currentPosition =
                wc.state?.currentPositionLiftPercent100ths ??
                (await wc.attributes?.currentPositionLiftPercent100ths?.get?.());
            }
          } catch {
            /* non-fatal */
          }

          // FanControl cluster
          try {
            const fan = agent.fanControl ?? agent.get?.("FanControl");
            if (fan) {
              const s = fan.state ?? {};
              attributes.fanMode = s.fanMode;
              attributes.fanSpeed = s.percentCurrent;
            }
          } catch {
            /* non-fatal */
          }
        });
      } else {
        // Fallback: check commissioning state for reachability
        const commState = clientNode.state?.commissioning;
        isReachable = !!commState?.onlineAt;
      }
    } catch {
      isReachable = false;
    }

    return { nodeId, deviceType, isReachable, attributes };
  }

  /**
   * Get states for all commissioned nodes.
   */
  async getAllDeviceStates(): Promise<MatterDeviceState[]> {
    if (!this.serverNode) {
      return [];
    }

    const peers = (this.serverNode as any).peers;
    if (!peers) return [];

    const states: MatterDeviceState[] = [];

    // Iterate over all peers (ClientNode instances)
    try {
      for (const clientNode of peers) {
        const nodeId = String(clientNode.id ?? clientNode.nodeId ?? "unknown");
        try {
          const state = await this.getDeviceState(nodeId);
          states.push(state);
        } catch {
          states.push({
            nodeId,
            deviceType: "unknown",
            isReachable: false,
            attributes: {},
          });
        }
      }
    } catch {
      // peers may not be iterable — return empty
    }

    return states;
  }

  /**
   * Send a command to a specific device.
   */
  async sendCommand(
    nodeId: string,
    clusterId: string,
    commandId: string,
    payload?: Record<string, unknown>
  ): Promise<void> {
    if (!this.serverNode) {
      throw new Error("Matter controller not initialized");
    }

    const peers = (this.serverNode as any).peers;
    const clientNode = peers?.get?.(nodeId);

    if (!clientNode) {
      throw new Error(`Node ${nodeId} not found`);
    }

    if (typeof clientNode.act !== "function") {
      throw new Error(`Node ${nodeId} does not support act()`);
    }

    await clientNode.act(async (agent: any) => {
      switch (clusterId) {
        case "onOff": {
          const cluster = agent.onOff ?? agent.get?.("OnOff");
          if (!cluster) throw new Error("OnOff cluster not available");
          switch (commandId) {
            case "on":
              await cluster.on();
              break;
            case "off":
              await cluster.off();
              break;
            case "toggle":
              await cluster.toggle();
              break;
            default:
              throw new Error(`Unknown command: ${commandId}`);
          }
          break;
        }

        case "levelControl": {
          const cluster =
            agent.levelControl ?? agent.get?.("LevelControl");
          if (!cluster)
            throw new Error("LevelControl cluster not available");
          if (commandId === "moveToLevel") {
            await cluster.moveToLevel({
              level: payload?.level ?? 128,
              transitionTime: payload?.transitionTime ?? 10,
              optionsMask: 0,
              optionsOverride: 0,
            });
          } else {
            throw new Error(`Unknown command: ${commandId}`);
          }
          break;
        }

        case "thermostat": {
          const cluster =
            agent.thermostat ?? agent.get?.("Thermostat");
          if (!cluster)
            throw new Error("Thermostat cluster not available");
          if (commandId === "setpointRaiseLower") {
            await cluster.setpointRaiseLower({
              mode: payload?.mode ?? 0,
              amount: payload?.amount ?? 10,
            });
          } else {
            throw new Error(`Unknown command: ${commandId}`);
          }
          break;
        }

        case "doorLock": {
          const cluster = agent.doorLock ?? agent.get?.("DoorLock");
          if (!cluster) throw new Error("DoorLock cluster not available");
          switch (commandId) {
            case "lock":
              await cluster.lockDoor({});
              break;
            case "unlock":
              await cluster.unlockDoor({});
              break;
            default:
              throw new Error(`Unknown command: ${commandId}`);
          }
          break;
        }

        case "windowCovering": {
          const cluster =
            agent.windowCovering ?? agent.get?.("WindowCovering");
          if (!cluster)
            throw new Error("WindowCovering cluster not available");
          switch (commandId) {
            case "upOrOpen":
              await cluster.upOrOpen();
              break;
            case "downOrClose":
              await cluster.downOrClose();
              break;
            case "stop":
              await cluster.stopMotion();
              break;
            default:
              throw new Error(`Unknown command: ${commandId}`);
          }
          break;
        }

        case "fanControl": {
          const cluster =
            agent.fanControl ?? agent.get?.("FanControl");
          if (!cluster)
            throw new Error("FanControl cluster not available");
          if (commandId === "setSpeed") {
            // Fan speed via attribute write
            if (cluster.setSpeedSettingAttribute) {
              await cluster.setSpeedSettingAttribute(payload?.speed ?? 0);
            } else if (cluster.state) {
              cluster.state.speedSetting = payload?.speed ?? 0;
            }
          } else {
            throw new Error(`Unknown command: ${commandId}`);
          }
          break;
        }

        default:
          throw new Error(`Unknown cluster: ${clusterId}`);
      }
    });
  }
}
