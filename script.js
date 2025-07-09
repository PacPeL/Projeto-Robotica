// Configuração do Firebase com as credenciais do projeto
const firebaseConfig = {
    apiKey: "AIzaSyC7t54W8mhFiCVxZlEeJ69AuNdhfdz1rrw", // Chave de API para autenticação
    authDomain: "projeto-mecatronica.firebaseapp.com", // Domínio para autenticação
    databaseURL: "https://projeto-mecatronica-default-rtdb.firebaseio.com", // URL do Realtime Database
    projectId: "projeto-mecatronica", // ID do projeto Firebase
    storageBucket: "projeto-mecatronica.firebasestorage.app", // Bucket de armazenamento
    messagingSenderId: "745084597517", // ID do remetente para mensagens
    appId: "1:745084597517:web:bc5f92e7c98694ea7dec44" // ID do aplicativo
};

// Inicializa o Firebase com as configurações definidas
firebase.initializeApp(firebaseConfig);
// Obtém a referência para o Realtime Database
const database = firebase.database();

// Referências aos nós de saída (atuadores) no Firebase
const refAutomatico = database.ref('output/AUTOMATICO'); // Modo automático
const refGarra = database.ref('output/GARRA'); // Garra
const refInicio = database.ref('output/TRAVA'); // Trava/Pino (início)
const refCentro = database.ref('output/MAGAZINE'); // Magazine (centro)
const refFinal = database.ref('output/MEDIDOR'); // Medidor (final)
const refPrensa = database.ref('output/ESTEIRA'); // Esteira (prensa)
const refMovFinal = database.ref('output/MOV_FINAL'); // Movimento final
const refMovInicial = database.ref('output/MOV_INICIAL'); // Movimento inicial

// Referências aos nós de entrada (sensores) no Firebase
const refSensorGarra = database.ref('input/SENSOR_GARRA'); // Sensor de garra
const refSensorMetalico = database.ref('input/SENSOR_METALICO'); // Sensor metálico
const refSensorFinal = database.ref('input/SENSOR_FINAL'); // Sensor final
const refSensorOptico2 = database.ref('input/SENSOR_OPTICO2'); // Sensor óptico 2
const refSensorMedidorMeio = database.ref('input/SENSOR_MEDIDOR_MEIO'); // Sensor medidor meio
const refSensorMedidorFinal = database.ref('input/SENSOR_MEDIDOR_FINAL'); // Sensor medidor final
const refSensorMagazine = database.ref('input/SENSOR_MAGAZINE'); // Sensor magazine

// Referências para os contadores e estatísticas
const refCycleStartTime = database.ref('counters/cycleStartTime'); // Tempo de início do ciclo
const refTimeHistory = database.ref('counters/timeHistory'); // Histórico de tempos de ciclo
const refAverageTime = database.ref('counters/averageTime'); // Tempo médio dos ciclos
const refCycleRunning = database.ref('counters/cycleRunning'); // Estado do ciclo (em execução ou não)

// Elemento que exibe o status da conexão com o Firebase
const connectionStatus = document.getElementById('connectionStatus');

// Elementos relacionados ao contador de tempo de ciclo
const cycleTimeElement = document.getElementById('cycleTime'); // Exibe o tempo atual do ciclo
const averageTimeElement = document.getElementById('averageTime'); // Exibe o tempo médio
const averageTimeTextElement = document.getElementById('averageTimeText'); // Texto da média
const timeHistoryElement = document.getElementById('timeHistory'); // Lista de histórico
const resetCountersBtn = document.getElementById('resetCountersBtn'); // Botão para resetar contadores

// Variáveis para controle do temporizador de ciclo
let cycleInterval; // Intervalo para atualização do contador
let cycleRunning = false; // Indica se um ciclo está em andamento
let cycleStartTime = 0; // Timestamp de início do ciclo
let timeHistory = []; // Array com histórico de tempos de ciclo
let averageTime = 0; // Tempo médio calculado
let lastSensorStates = {}; // Armazena os últimos estados dos sensores para evitar atualizações desnecessárias

// Monitora o estado da conexão com o Firebase
const connectedRef = database.ref(".info/connected");
connectedRef.on("value", function(snap) {
    if (snap.val() === true) {
        connectionStatus.textContent = "Conectado ao Firebase";
        connectionStatus.className = "status connected";
    } else {
        connectionStatus.textContent = "Desconectado do Firebase";
        connectionStatus.className = "status disconnected";
    }
});

// Atualiza a aparência de um botão com base no estado (on/off)
function updateButton(button, state) {
    if (state === "on") {
        button.classList.remove("btn-off");
        button.classList.add("btn-on");
        button.textContent = button === document.getElementById('automaticoBtn') ? "AUTOMÁTICO LIGADO" : "LIGADO";
    } else {
        button.classList.remove("btn-on");
        button.classList.add("btn-off");
        button.textContent = button === document.getElementById('automaticoBtn') ? "AUTOMÁTICO DESLIGADO" : "DESLIGADO";
    }
}

// Atualiza a aparência de um sensor com base no estado (on/off)
function updateSensor(sensor, state) {
    if (state === "on") {
        sensor.classList.remove("btn-off");
        sensor.classList.add("btn-on");
        sensor.textContent = "ATIVO";
    } else {
        sensor.classList.remove("btn-on");
        sensor.classList.add("btn-off");
        sensor.textContent = "INATIVO";
    }
}

// Converte segundos em formato HH:MM:SS
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        secs.toString().padStart(2, '0')
    ].join(':');
}

// Atualiza o contador de tempo do ciclo em execução
function updateCycleTimer(startTime) {
    if (cycleInterval) clearInterval(cycleInterval);
    
    if (startTime) {
        cycleInterval = setInterval(() => {
            const currentTime = Math.floor(Date.now() / 1000);
            const elapsedTime = currentTime - startTime;
            cycleTimeElement.textContent = formatTime(elapsedTime);
        }, 1000);
    } else {
        cycleTimeElement.textContent = "00:00:00";
    }
}

// Calcula a média de tempos de um array
function calculateAverageTime(times) {
    if (times.length === 0) return 0;
    
    const sum = times.reduce((total, time) => total + time, 0);
    return Math.round(sum / times.length);
}

// Atualiza a exibição do histórico de tempos, evitando duplicações
function updateTimeHistory(history) {
    timeHistoryElement.innerHTML = '';
    
    if (history.length === 0) {
        timeHistoryElement.innerHTML = '<div style="color: #888; font-style: italic;">Sem dados de histórico</div>';
        return;
    }
    
    // Mostrar os últimos 10 tempos únicos
    const uniqueHistory = [];
    const seenTimes = new Set();
    
    for (let i = history.length - 1; i >= 0; i--) {
        const time = history[i];
        if (!seenTimes.has(time)) {
            seenTimes.add(time);
            uniqueHistory.unshift(time); // Mantém a ordem cronológica
            if (uniqueHistory.length >= 10) break;
        }
    }
    
    // Exibe os itens do histórico
    uniqueHistory.reverse().forEach((time, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <span>Ciclo #${history.length - index}</span>
            <span>${formatTime(time)}</span>
        `;
        timeHistoryElement.appendChild(historyItem);
    });
    
    // Atualiza a média
    averageTime = calculateAverageTime(history);
    averageTimeElement.textContent = formatTime(averageTime);
    averageTimeTextElement.textContent = `Média: ${formatTime(averageTime)}`;
}

// Inicia um novo ciclo quando a garra é fechada
function startCycle() {
    if (!cycleRunning) {
        cycleRunning = true;
        cycleStartTime = Math.floor(Date.now() / 1000);
        refCycleStartTime.set(cycleStartTime);
        refCycleRunning.set(true);
        updateCycleTimer(cycleStartTime);
    }
}

// Finaliza o ciclo quando a garra é aberta
function endCycle() {
    if (cycleRunning) {
        cycleRunning = false;
        const currentTime = Math.floor(Date.now() / 1000);
        const cycleDuration = currentTime - cycleStartTime;
        
        // Adiciona o tempo ao histórico no Firebase
        refTimeHistory.transaction((currentHistory) => {
            const history = currentHistory || [];
            // Evita duplicação de tempos
            if (!history.includes(cycleDuration)) {
                history.push(cycleDuration);
            }
            return history;
        });
        
        // Recalcula a média
        refTimeHistory.once('value').then((snapshot) => {
            const history = snapshot.val() || [];
            const newAverage = calculateAverageTime(history);
            refAverageTime.set(newAverage);
        });
        
        // Reseta o contador
        refCycleStartTime.set(null);
        refCycleRunning.set(false);
        updateCycleTimer(null);
    }
}

// Listener para mudanças no tempo de início do ciclo
refCycleStartTime.on('value', (snapshot) => {
    const startTime = snapshot.val();
    if (startTime) {
        updateCycleTimer(startTime);
    } else {
        updateCycleTimer(null);
    }
});

// Listener para mudanças no histórico de tempos
refTimeHistory.on('value', (snapshot) => {
    const history = snapshot.val() || [];
    timeHistory = history;
    updateTimeHistory(history);
});

// Listener para mudanças no tempo médio
refAverageTime.on('value', (snapshot) => {
    const avg = snapshot.val() || 0;
    averageTime = avg;
    averageTimeElement.textContent = formatTime(avg);
    averageTimeTextElement.textContent = `Média: ${formatTime(avg)}`;
});

// Listener para mudanças no estado do ciclo (em execução ou não)
refCycleRunning.on('value', (snapshot) => {
    cycleRunning = snapshot.val() || false;
});

// Listener para mudanças no estado da garra (controla início/fim do ciclo)
refGarra.on('value', (snapshot) => {
    const state = snapshot.val().state;
    updateButton(document.getElementById('garraBtn'), state);
    
    if (state === "on") {
        startCycle(); // Garra fechada = ciclo iniciado
    } else {
        endCycle(); // Garra aberta = ciclo finalizado
    }
});

// Listeners para atualização dos estados dos atuadores na interface
refAutomatico.on('value', (snapshot) => {
    updateButton(document.getElementById('automaticoBtn'), snapshot.val().state);
});

refInicio.on('value', (snapshot) => {
    updateButton(document.getElementById('inicioBtn'), snapshot.val().state);
});

refCentro.on('value', (snapshot) => {
    updateButton(document.getElementById('centroBtn'), snapshot.val().state);
});

refFinal.on('value', (snapshot) => {
    updateButton(document.getElementById('finalBtn'), snapshot.val().state);
});

refPrensa.on('value', (snapshot) => {
    updateButton(document.getElementById('prensaBtn'), snapshot.val().state);
});

refMovFinal.on('value', (snapshot) => {
    updateButton(document.getElementById('movFinalBtn'), snapshot.val().state);
});

refMovInicial.on('value', (snapshot) => {
    updateButton(document.getElementById('movInicialBtn'), snapshot.val().state);
});

// Configura listeners para os sensores com verificação de mudança de estado
function setupSensorListener(ref, elementId, sensorName) {
    ref.on('value', (snapshot) => {
        const currentState = snapshot.val().state;
        
        // Só atualiza se o estado mudou
        if (lastSensorStates[sensorName] !== currentState) {
            lastSensorStates[sensorName] = currentState;
            updateSensor(document.getElementById(elementId), currentState);
        }
    });
}

// Configura listeners para todos os sensores
setupSensorListener(refSensorGarra, 'sensorGarra', 'sensorGarra');
setupSensorListener(refSensorMetalico, 'sensorMetalico', 'sensorMetalico');
setupSensorListener(refSensorFinal, 'sensorFinal', 'sensorFinal');
setupSensorListener(refSensorOptico2, 'sensorOptico2', 'sensorOptico2');
setupSensorListener(refSensorMedidorMeio, 'sensorMedidorMeio', 'sensorMedidorMeio');
setupSensorListener(refSensorMedidorFinal, 'sensorMedidorFinal', 'sensorMedidorFinal');
setupSensorListener(refSensorMagazine, 'sensorMagazine', 'sensorMagazine');

// Alterna o estado de um nó no Firebase (on/off)
function toggleState(ref) {
    ref.once('value').then((snapshot) => {
        const currentState = snapshot.val().state;
        const newState = currentState === "on" ? "off" : "on";
        ref.update({ state: newState });
    });
}

// Evento para o botão de resetar contadores
resetCountersBtn.addEventListener('click', () => {
    if (confirm("Tem certeza que deseja reiniciar todos os contadores e o histórico?")) {
        refCycleStartTime.set(null);
        refTimeHistory.set([]);
        refAverageTime.set(0);
        refCycleRunning.set(false);
        updateCycleTimer(null);
        updateTimeHistory([]);
    }
});

// Event listeners para os botões de controle
document.getElementById('automaticoBtn').addEventListener('click', () => {
    toggleState(refAutomatico);
});

document.getElementById('garraBtn').addEventListener('click', () => {
    toggleState(refGarra);
});

document.getElementById('inicioBtn').addEventListener('click', () => {
    toggleState(refInicio);
});

document.getElementById('centroBtn').addEventListener('click', () => {
    toggleState(refCentro);
});

document.getElementById('finalBtn').addEventListener('click', () => {
    toggleState(refFinal);
});

document.getElementById('prensaBtn').addEventListener('click', () => {
    toggleState(refPrensa);
});

document.getElementById('movFinalBtn').addEventListener('click', () => {
    toggleState(refMovFinal);
});

document.getElementById('movInicialBtn').addEventListener('click', () => {
    toggleState(refMovInicial);
});

// Inicialização dos contadores ao carregar a página
window.addEventListener('load', () => {
    refCycleRunning.once('value').then((snapshot) => {
        if (!snapshot.exists()) {
            refCycleRunning.set(false);
        }
    });
    
    refTimeHistory.once('value').then((snapshot) => {
        if (!snapshot.exists()) {
            refTimeHistory.set([]);
        }
    });
    
    refAverageTime.once('value').then((snapshot) => {
        if (!snapshot.exists()) {
            refAverageTime.set(0);
        }
    });
});

// Código para Progressive Web App (PWA)
let deferredPrompt; // Armazena o evento de instalação
const installContainer = document.getElementById('installContainer');
const installButton = document.getElementById('installButton');
const closeInstall = document.getElementById('closeInstall');

// Evento disparado quando o navegador quer sugerir instalação
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installContainer.style.display = 'block'; // Mostra o banner de instalação
});

// Evento para o botão de instalação
installButton.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            installContainer.style.display = 'none'; // Esconde o banner se instalado
        }
        deferredPrompt = null;
    }
});

// Evento para fechar o banner de instalação
closeInstall.addEventListener('click', () => {
    installContainer.style.display = 'none';
});

// Evento quando o PWA é instalado com sucesso
window.addEventListener('appinstalled', () => {
    installContainer.style.display = 'none';
});

// Verifica se já está rodando como PWA
if (window.matchMedia('(display-mode: standalone)').matches) {
    installContainer.style.display = 'none'; // Não mostra banner se já for PWA
}