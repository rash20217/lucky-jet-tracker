from telegram import Update, Bot
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes
import requests
import asyncio

# === Ton token de @BotFather ===
TELEGRAM_TOKEN = '8071645184:AAFe2XF8DFZTnq5SDJ3A0l4q7skdrV-8Jr4'

# === Ton chat ID personnel ou groupe ===
CHAT_ID = '8071645184'  # ex: '123456789'

# === Récupération des dernières cotes Lucky Jet ===
def get_last_crash_values(n=20):
    url = "https://api.tipmanager.net/v1/bot_casino/get_crash_results"
    try:
        response = requests.get(url)
        data = response.json()
        return [float(i["value"]) for i in data["data"][:n]]
    except Exception as e:
        return ["Erreur de connexion"]

# === Algorithme de prédiction simple ===
def predict_next_crashes(values):
    prediction = []
    for i in range(10):
        if values[-3:] == [1.01, 1.10, 1.20]:
            prediction.append(3.00 + i * 0.5)
        elif values[-1] < 1.5:
            prediction.append(2.5 + (i % 2) * 0.6)
        else:
            prediction.append(1.2 + (i % 4) * 0.4)
    return prediction

# === Commande /start ===
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Bienvenue ! Le bot t’enverra une prédiction toutes les 2 minutes.\nTape /predict pour une prédiction manuelle.")

# === Commande /predict ===
async def predict(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await send_prediction(context.bot, update.effective_chat.id)

# === Fonction pour envoyer la prédiction automatique ===
async def send_prediction(bot: Bot, chat_id: str):
    values = get_last_crash_values()
    if isinstance(values[0], str):
        await bot.send_message(chat_id=chat_id, text="Erreur lors de la récupération des données.")
        return

    preds = predict_next_crashes(values)
    message = f"**Dernières cotes Lucky Jet :**\n{values[:10]}\n\n**Prédictions prochaines parties :**\n"
    for i, p in enumerate(preds, 1):
        message += f"Tour {i} → {round(p, 2)}x\n"

    await bot.send_message(chat_id=chat_id, text=message)

# === Boucle automatique toutes les 2 minutes ===
async def auto_prediction_loop(bot: Bot):
    while True:
        await send_prediction(bot, CHAT_ID)
        await asyncio.sleep(120)  # 120 secondes = 2 minutes

# === Lancement du bot ===
async def main():
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("predict", predict))

    # Lancement simultané de la boucle automatique
    asyncio.create_task(auto_prediction_loop(app.bot))

    print("Bot avec prédiction automatique démarré...")
    await app.run_polling()

# === Démarrage ===
if __name__ == "__main__":
    asyncio.run(main())
