/**
 * Alexa Skill Lambda handler for OpenFrame Kiosk.
 *
 * Uses Alexa.Presentation.HTML to load the web app on Echo Show devices.
 * Config persisted via ask-sdk-s3-persistence-adapter (Alexa-hosted S3 bucket).
 */

import Alexa from "ask-sdk-core";
import { S3PersistenceAdapter } from "ask-sdk-s3-persistence-adapter";
import { getConfig, saveConfig, clearConfig, getWebAppUrl } from "./util.mjs";

// --- Persistence adapter (Alexa-hosted skills provide S3_PERSISTENCE_BUCKET) ---
const persistenceAdapter = new S3PersistenceAdapter({
  bucketName: process.env.S3_PERSISTENCE_BUCKET || "openframe-alexa-skill",
});

// --- Helpers ---

function supportsHTML(handlerInput) {
  const interfaces =
    handlerInput.requestEnvelope.context?.System?.device?.supportedInterfaces;
  return !!interfaces?.["Alexa.Presentation.HTML"];
}

function buildStartDirective(webAppUrl, data) {
  return {
    type: "Alexa.Presentation.HTML.Start",
    request: {
      uri: webAppUrl,
      method: "GET",
    },
    configuration: {
      timeoutInSeconds: 1800, // 30 min max session
    },
    data,
  };
}

function buildMessageDirective(data) {
  return {
    type: "Alexa.Presentation.HTML.HandleMessage",
    message: data,
  };
}

// --- Intent Handlers ---

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest"
    );
  },
  async handle(handlerInput) {
    if (!supportsHTML(handlerInput)) {
      return handlerInput.responseBuilder
        .speak(
          "Sorry, OpenFrame requires an Echo Show with a screen. Please try on an Echo Show device."
        )
        .getResponse();
    }

    const config = await getConfig(
      handlerInput.attributesManager
    );
    const webAppUrl = getWebAppUrl();

    const data = config.serverUrl
      ? {
          serverUrl: config.serverUrl,
          kioskToken: config.kioskToken,
          needsSetup: false,
        }
      : { needsSetup: true };

    return handlerInput.responseBuilder
      .speak(
        config.serverUrl
          ? "Opening OpenFrame."
          : "Welcome to OpenFrame. Please set up your server connection."
      )
      .addDirective(buildStartDirective(webAppUrl, data))
      .getResponse();
  },
};

const NavigateIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "NavigateIntent"
    );
  },
  handle(handlerInput) {
    const page =
      Alexa.getSlotValue(handlerInput.requestEnvelope, "page") || "home";

    return handlerInput.responseBuilder
      .addDirective(
        buildMessageDirective({ action: "navigate", page })
      )
      .getResponse();
  },
};

const NextPageIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "NextPageIntent"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .addDirective(buildMessageDirective({ action: "next" }))
      .getResponse();
  },
};

const PreviousPageIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "PreviousPageIntent"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .addDirective(buildMessageDirective({ action: "previous" }))
      .getResponse();
  },
};

const RefreshIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "RefreshIntent"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .addDirective(buildMessageDirective({ action: "refresh" }))
      .getResponse();
  },
};

const SetupIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "SetupIntent"
    );
  },
  async handle(handlerInput) {
    await clearConfig(handlerInput.attributesManager);

    return handlerInput.responseBuilder
      .speak("Opening setup. Please configure your server connection.")
      .addDirective(
        buildMessageDirective({ action: "setup" })
      )
      .getResponse();
  },
};

/**
 * Receives messages from the web app (config saves, status updates).
 */
const ProcessHTMLMessageHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) ===
      "Alexa.Presentation.HTML.Message"
    );
  },
  async handle(handlerInput) {
    const message = handlerInput.requestEnvelope.request.message;

    if (message?.action === "saveConfig") {
      await saveConfig(
        handlerInput.attributesManager,
        message.serverUrl,
        message.kioskToken
      );
      return handlerInput.responseBuilder
        .addDirective(
          buildMessageDirective({ action: "configSaved", success: true })
        )
        .getResponse();
    }

    if (message?.action === "clearConfig") {
      await clearConfig(handlerInput.attributesManager);
      return handlerInput.responseBuilder
        .addDirective(
          buildMessageDirective({ action: "configCleared", success: true })
        )
        .getResponse();
    }

    if (message?.action === "keepAlive") {
      // Web app pings to keep session alive; just respond
      return handlerInput.responseBuilder.getResponse();
    }

    // Unknown message — acknowledge silently
    return handlerInput.responseBuilder.getResponse();
  },
};

// --- Built-in Intent Handlers ---

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(
        "You can say things like: show calendar, next page, go back, or refresh. Say set up to change your server connection."
      )
      .reprompt("What would you like to do?")
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.CancelIntent" ||
        Alexa.getIntentName(handlerInput.requestEnvelope) ===
          "AMAZON.StopIntent")
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.speak("Goodbye.").getResponse();
  },
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.FallbackIntent"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(
        "I didn't understand that. Try saying show calendar, next page, or refresh."
      )
      .reprompt("What would you like to do?")
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) ===
      "SessionEndedRequest"
    );
  },
  handle(handlerInput) {
    console.log(
      `Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`
    );
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error(`Error handled: ${error.message}`, error.stack);
    return handlerInput.responseBuilder
      .speak("Sorry, something went wrong. Please try again.")
      .getResponse();
  },
};

// --- Skill Builder ---

export const handler = Alexa.SkillBuilders.custom()
  .withPersistenceAdapter(persistenceAdapter)
  .addRequestHandlers(
    LaunchRequestHandler,
    NavigateIntentHandler,
    NextPageIntentHandler,
    PreviousPageIntentHandler,
    RefreshIntentHandler,
    SetupIntentHandler,
    ProcessHTMLMessageHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
