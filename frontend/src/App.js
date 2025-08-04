import React, { useState, useEffect, useRef } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { Users, Trophy, Zap, Settings, Play, Square, Crown, Gift } from 'lucide-react';
import './App.css';

const DEMO_USERS = [
  'StreamFan123', 'GamerPro', 'TwitchLover', 'ChatMaster', 'ViewerOne',
  'KappaPride', 'EpicGamer', 'StreamSniper', 'ChatBot2023', 'ProViewer',
  'TwitchNinja', 'StreamKing', 'ViewerMaster', 'ChatLegend', 'GameOn',
  'StreamHero', 'TwitchStar', 'ViewerPro', 'ChatChampion', 'StreamFan'
];

const DEMO_MESSAGES = [
  'Привет стрим!', 'Классная игра!', 'Первый!', 'Как дела?', 
  'Крутой контент!', 'Удачи в игре!', 'Смотрю каждый день!',
  'Лучший стример!', 'Интересно!', 'Продолжай в том же духе!'
];

function App() {
  const [streamUrl, setStreamUrl] = useState('');
  const [keyword, setKeyword] = useState('!участвую');
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [winner, setWinner] = useState(null);
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false);
  const chatEndRef = useRef(null);

  // Симуляция чата
  useEffect(() => {
    if (isListening) {
      const interval = setInterval(() => {
        const randomUser = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)];
        const isKeywordMessage = Math.random() < 0.3; // 30% шанс ключевого слова
        const message = isKeywordMessage ? keyword : DEMO_MESSAGES[Math.floor(Math.random() * DEMO_MESSAGES.length)];
        
        const newMessage = {
          id: Date.now(),
          username: randomUser,
          message: message,
          timestamp: new Date().toLocaleTimeString(),
          isKeyword: isKeywordMessage
        };

        setChatMessages(prev => [...prev.slice(-50), newMessage]);
        
        // Добавляем участника если написал ключевое слово
        if (isKeywordMessage && !participants.includes(randomUser)) {
          setParticipants(prev => [...prev, randomUser]);
        }
      }, Math.random() * 3000 + 1000); // Сообщения каждые 1-4 секунды

      return () => clearInterval(interval);
    }
  }, [isListening, keyword, participants]);

  // Автоскролл чата
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const startListening = () => {
    if (!streamUrl.trim()) {
      alert('Введите ссылку на стрим!');
      return;
    }
    setIsListening(true);
    setChatMessages([{
      id: 0,
      username: 'TwitchBot',
      message: `🎉 Розыгрыш начался! Пишите "${keyword}" для участия!`,
      timestamp: new Date().toLocaleTimeString(),
      isSystem: true
    }]);
  };

  const stopListening = () => {
    setIsListening(false);
  };

  const selectWinner = () => {
    if (participants.length === 0) {
      alert('Нет участников для розыгрыша!');
      return;
    }

    const randomIndex = Math.floor(Math.random() * participants.length);
    const selectedWinner = participants[randomIndex];
    
    setWinner(selectedWinner);
    setShowWinnerAnimation(true);
    
    // Убираем анимацию через 5 секунд
    setTimeout(() => {
      setShowWinnerAnimation(false);
    }, 5000);

    // Добавляем сообщение о победителе в чат
    setChatMessages(prev => [...prev, {
      id: Date.now(),
      username: 'TwitchBot',
      message: `🏆 Поздравляем ${selectedWinner}! Вы выиграли!`,
      timestamp: new Date().toLocaleTimeString(),
      isSystem: true
    }]);
  };

  const clearParticipants = () => {
    setParticipants([]);
    setWinner(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-purple-800">
      {/* Winner Animation Overlay */}
      {showWinnerAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
          <div className="text-center animate-bounce">
            <Crown className="w-24 h-24 mx-auto text-yellow-400 mb-4 animate-spin" />
            <h1 className="text-6xl font-bold text-white mb-4 animate-pulse">🎉 ПОБЕДИТЕЛЬ! 🎉</h1>
            <h2 className="text-4xl font-bold text-yellow-400 mb-8">{winner}</h2>
            <div className="text-2xl text-white">Поздравляем с победой!</div>
          </div>
        </div>
      )}

      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Gift className="w-12 h-12 text-purple-400" />
            <h1 className="text-4xl font-bold text-white">Twitch Розыгрыш</h1>
            <Trophy className="w-12 h-12 text-yellow-400" />
          </div>
          <p className="text-gray-300 text-lg">Автоматический розыгрыш призов для вашего стрима</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-1">
            <Card className="bg-gray-900 border-gray-700 p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Settings className="w-6 h-6 text-purple-400" />
                Настройки
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">
                    Ссылка на стрим
                  </label>
                  <Input
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="https://twitch.tv/your_channel"
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">
                    Ключевое слово
                  </label>
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="!участвую"
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>

                <Separator className="bg-gray-600" />

                <div className="flex gap-2">
                  {!isListening ? (
                    <Button
                      onClick={startListening}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Начать
                    </Button>
                  ) : (
                    <Button
                      onClick={stopListening}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Стоп
                    </Button>
                  )}
                </div>

                {isListening && (
                  <div className="flex items-center gap-2 text-green-400 animate-pulse">
                    <Zap className="w-4 h-4" />
                    <span className="text-sm">Слушаем чат...</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Participants */}
            <Card className="bg-gray-900 border-gray-700 p-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Участники ({participants.length})
                </h3>
                <Button
                  onClick={clearParticipants}
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  Очистить
                </Button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2">
                {participants.map((participant, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg animate-fadeIn"
                  >
                    <Badge variant="outline" className="border-purple-500 text-purple-400">
                      {index + 1}
                    </Badge>
                    <span className="text-white">{participant}</span>
                  </div>
                ))}
              </div>

              {participants.length > 0 && (
                <Button
                  onClick={selectWinner}
                  className="w-full mt-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  Выбрать победителя!
                </Button>
              )}

              {winner && !showWinnerAnimation && (
                <div className="mt-4 p-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500 rounded-lg">
                  <div className="text-center">
                    <Crown className="w-6 h-6 mx-auto text-yellow-400 mb-2" />
                    <div className="text-sm text-gray-300">Последний победитель:</div>
                    <div className="text-lg font-bold text-yellow-400">{winner}</div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Chat */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-900 border-gray-700 p-6 h-[600px] flex flex-col">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                💬 Чат Twitch
                {isListening && (
                  <Badge className="bg-green-600 text-white animate-pulse">LIVE</Badge>
                )}
              </h2>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg animate-slideIn ${
                      msg.isSystem 
                        ? 'bg-blue-900/50 border border-blue-500' 
                        : msg.isKeyword 
                          ? 'bg-purple-900/50 border border-purple-500' 
                          : 'bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          msg.isSystem ? 'border-blue-400 text-blue-400' : 'border-gray-500 text-gray-400'
                        }`}
                      >
                        {msg.username}
                      </Badge>
                      <span className="text-xs text-gray-500">{msg.timestamp}</span>
                      {msg.isKeyword && (
                        <Badge className="bg-purple-600 text-white text-xs">
                          Участник!
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm ${
                      msg.isSystem ? 'text-blue-300 font-semibold' : 'text-white'
                    }`}>
                      {msg.message}
                    </p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {!isListening && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-4">💭</div>
                  <p>Введите ссылку на стрим и нажмите "Начать" для подключения к чату</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;