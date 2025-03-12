//const PongGame = require("./main");

let chatSocket;
const listeConversation = document.getElementById('liste-amis-live-chat-ul');
let destinataireId = null;

// initialise le websocket de chat
function initWebSocket() {
	// Vérifie si une connexion est déjà ouverte
	if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
		console.warn("Une connexion WebSocket est déjà ouverte.");
		return;
	}

	// Création d'un nouveau WebSocket
	chatSocket = new WebSocket(`wss://${window.location.host}/wss/chat/`);
	console.log("websocket créé");

	// Associe les fonctions aux événements WebSocket
	chatSocket.onmessage = handleIncomingMessage;
	chatSocket.onerror = handleWebSocketError;
	chatSocket.onclose = handleWebSocketClose;
}

// gere les messages recus
function handleIncomingMessage(e) {
	const data = JSON.parse(e.data);
	console.log("data.type : '", data.type, "', data.message : '", data.message, "'");
	if (data.type === 'message') {
		afficherMessage(data);
	} else if (data.type === 'block_user') {
		if (destinataireId == data.blocker_id)
		{
			HistoriqueMessages(data.blocker_id, data.blocker_username);
		}
	} else if (data.type === 'pong_invitation') {
		const messageContainer = document.getElementById('message-container');
		if (!messageContainer) {
			console.error("messageContainer introuvable !");
			return;
		}
		invitationJeu(data.message);
		messageContainer.scrollTop = messageContainer.scrollHeight;
	} else if (data.type === 'connection_status') {
		const onlineStatusElementProfileView = document.getElementsByClassName("onlineOrOfflineStatus")[0]; // Accéder au premier élément avec cette classe
		if(onlineStatusElementProfileView) {
			console.log("onlineStatusElementProfileView existe");
			if (data.status === "connected") {
				onlineStatusElementProfileView.innerHTML = `en ligne`;  // Met à jour le texte
				onlineStatusElementProfileView.id = "liveChat-onlineStatus";  // Change l'id de l'élément
			} else {
				onlineStatusElementProfileView.innerHTML = `hors ligne`;  // Met à jour le texte
				onlineStatusElementProfileView.id = "liveChat-offlineStatus";  // Change l'id de l'élément
			}
		}
		else {
			console.log("onlineStatusElementProfileView n'existe pas");
		}
		if (destinataireId === data.user_id) {
			const onlineStatusElement = document.getElementsByClassName("liveChat-online-offline-Status")[0]; // Accéder au premier élément avec cette classe
			
			if (data.status === "connected") {
				onlineStatusElement.innerHTML = `en ligne`;  // Met à jour le texte
				onlineStatusElement.id = "liveChat-onlineStatus";  // Change l'id de l'élément
			} else {
				onlineStatusElement.innerHTML = `hors ligne`;  // Met à jour le texte
				onlineStatusElement.id = "liveChat-offlineStatus";  // Change l'id de l'élément
			}
		}
	} else if (data.type === 'Partie non trouvée') {
		console.log("partie non trouvée");
	} else {
		console.warn("Le type de message n'est pas reconnu. data : '", data, "' mesage : '", data.type, "', data.message : '", data.message, "'");
	}
}

function handleWebSocketError(e) {
	console.error('Erreur WebSocket : ', e);
}

function handleWebSocketClose() {
	console.log('WebSocket fermé, tentez de reconnecter si nécessaire');
}

// gere les messages recu en rapport au partie via le liveCHat
function invitationJeu(message) {
	const messageContainer = document.getElementById('message-container');
	if (!messageContainer) {
		console.error("messageContainer introuvable !");
		return;
	}

	charIdInvitation = "Invitation_" + message.message_id;
	messageElement = document.getElementById(charIdInvitation);
	if (messageElement) {
		afficherInvitationJeu(message, messageElement);
	}
	else {
		messageElement = document.createElement('div');
		messageElement.classList.add('message-invitation-jeu');
		messageElement.id = charIdInvitation;
		// Ajoute l'élément au DOM avant de le manipuler
		messageContainer.appendChild(messageElement);
		afficherInvitationJeu(message, messageElement);
	}
}

// affiche des messages spécifiques pour les invitations et les résultats d'une partie, en adaptant le contenu à l'expéditeur, au destinataire, et au contexte.
function afficherInvitationJeu(message, messageElement) {
	if (message.message === "invitation à jouer") {
		if ((message.expediteur_id !== destinataireId) && (message.destinataire_id !== destinataireId))
			{
				showNotification(`Nouvelle invitation à jouer de ${message.expediteur_username}`);
				return;
			}
		if (message.expediteur_id === destinataireId) {
			messageElement.innerHTML = `
				${message.expediteur_username} vous invite à jouer une partie
				<button class="bouton-liveChat" onclick="invitationAccepte(${message.expediteur_id}, '${message.message_id}')">accepter</button>
				<button class="bouton-liveChat" onclick="invitationRefuse(${message.expediteur_id}, '${message.message_id}')">refuser</button>
			`;
		} else {
			messageElement.innerHTML = `
				vous avez invité ${message.destinataire_username} à jouer une partie
				<button class="bouton-liveChat" onclick="invitationAnnule(${message.destinataire_id}, '${message.message_id}')">annuler</button>
			`;
		}
		return ;
	} else if (message.message === "temps écoulé") {
		messageElement.innerHTML = `L'invitation est obsolète`;
	} else if (message.message === "invitation annulée") {
		if (message.expediteur_id === destinataireId) {
			messageElement.innerHTML = `
				${message.expediteur_username} a annulé une invitation
			`;
		} else {
			messageElement.innerHTML = `
				Vous avez annulé l'invitation
			`;
		}
	} else if (message.message === "invitation refusée") {
		if (message.expediteur_id === destinataireId) {
			messageElement.innerHTML = `
				${message.expediteur_username} a refusé votre invitation
			`;
		} else {
			messageElement.innerHTML = `
				Vous avez refusé l'invitation
			`;
		}
	} else if (message.message === "invitation acceptée") {
		if (message.expediteur_id === destinataireId) {
			console.log("je recois l'invitation et j'accepte");
			messageElement.innerHTML = `
				invitation acceptée, partie en cours...
			`;
		} else {
			console.log("j'ai invité");
			messageElement.innerHTML = `
				invitation acceptée, partie en cours...
			`;
	
			// Appel de la fonction joinGame et vérification du succès
			console.log("réponse joingame : ", PongGame.joinGame(message.gameId));
		}
	} else if (message.message === "resultats partie"){
		if (message.winners.includes(parseInt(destinataireId)) && destinataireId === message.destinataire_id) {
			messageElement.innerHTML = `
				Partie terminée<br>
				${message.destinataire_username} a gagné, vous avez perdu
			`;
		} else if (message.winners.includes(parseInt(destinataireId)) && destinataireId !== message.destinataire_id) {
			messageElement.innerHTML = `
				Partie terminée<br>
				Vous avez gagné, ${message.expediteur_username} a perdu
			`;
		} else if (!message.winners.includes(parseInt(destinataireId)) && destinataireId === message.destinataire_id) {
			messageElement.innerHTML = `
				Partie terminée<br>
				${message.destinataire_username} a gagné, vous avez perdu
			`;
		} else {
			messageElement.innerHTML = `
				Partie terminée<br>
				Vous avez gagné, ${message.expediteur_username} a perdu
			`;
		}
	} else if (message.message === "Partie non trouvée"){
		messageElement.innerHTML = `
			Erreur<br>
		`;
	} else {
		console.log("Une erreur est survenue, message.mesage = '", message.message, "'");
	}
}

// envoie un message via websocket si l'utilisateur annule la partie
function invitationAnnule(destinataire_id, message_id) {
	chatSocket.send(JSON.stringify({
		'type': "pong_invitation_annulation",
		'destinataire_id': destinataire_id,
		'message_id_db': message_id
	}));
}

// envoie un message via websocket si l'utilisateur refuse la partie
function invitationRefuse(expediteur_id, message_id) {
	chatSocket.send(JSON.stringify({
		'type': "pong_invitation_refuse",
		'destinataire_id': expediteur_id,
		'message_id_db': message_id
	}));
}

// Envoie une invitation à jouer à Pong via WebSocket à un destinataire spécifié par son IdDestinataire.
function inviterPartiePong(IdDestinataire) {
	console.log("fonction inviterPartiePong, IdDestinataire = ", IdDestinataire);
	chatSocket.send(JSON.stringify({
		'type': "pong_invitation",
		'destinataire_id': IdDestinataire
	}));
}

// crée une partie en remote puis envoie un message via websocket si l'utilisateur accepte la partie
function invitationAccepte(expediteur_id, message_id) {
	PongGame.createNewGame(true, 2, true)
		.then(gameId => {
			if (gameId === null || gameId === undefined) {
				console.error("Game ID invalide. Le message WebSocket ne sera pas envoyé.");
				return;
			}

			chatSocket.send(JSON.stringify({
				'type': "pong_invitation_accepté",
				'destinataire_id': expediteur_id,
				'message_id_db': message_id,
				'gameId': gameId
			}));
		})
		.catch(error => {
			console.error("Erreur lors de la création du jeu ou de l'envoi via WebSocket :", error);
		});
}


// affiche les messages recus
function afficherMessage(data) {
	message = data.message;
	const messageContainer = document.getElementById('message-container');
	if (!messageContainer) {
		console.error("Le conteneur de messages n'a pas été trouvé !");
		return; // Sort de la fonction si le conteneur n'existe pas
	}

	// Création de l'élément pour chaque message
	const messageElement = document.createElement('div');
	console.log("destinataireId = ", destinataireId, ", message.expediteur_id = ", message.expediteur_id);
	if (message.expediteur_id === destinataireId)
	{
		messageElement.classList.add('message-destinataire');
	}
	else if (message.destinataire_id === destinataireId)
		messageElement.classList.add('message-expediteur');
	else {
		console.log("message recu de ", message.expediteur_id);
		showNotification(`Nouveau message de ${message.expediteur}`);
	}

	messageElement.textContent = `${message.expediteur}: ${message.message}`;
	messageContainer.appendChild(messageElement);
	messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Affiche une notification avec le message donné, rend la pop-up visible, puis la cache après 5 secondes
function showNotification(message) {
	console.log("[showNotification] : '", message, "'");
	const popup = document.getElementById('notification-popup');
	popup.textContent = message;
	popup.classList.add('show');

	// Cachez la pop-up après 5 secondes
	setTimeout(() => {
		console.log("[showNotification] : '", message, "' 2");
		popup.classList.remove('show');
	}, 5000);
}

// Affiche la liste des amis,
// réinitialise le champ de recherche,
// charge les conversations depuis l'API
async function listeAmisLiveChat() {
    console.log("[listeAmisLiveChat]");
    document.getElementById('liste-amis-live-chat').style.display = 'block';
    document.getElementById('conversation-live-chat').style.display = 'none';
    document.getElementById('searchInput').value = '';
    document.getElementById('userListContainer').innerHTML = '';
    document.getElementById('searchInput').addEventListener('input', handleSearchInput);
    destinataireId = null;

    try {
        const response = await fetch('/api/listeconversation/');
        const data = await response.json();

        if (data.error) {
            console.log("Aucune conversation trouvée");
            return;
        }

        const listeConversation = document.getElementById('liste-amis-live-chat-ul');
        listeConversation.innerHTML = '';

        const users = new Map();

        // Ajouter les utilisateurs des conversations
        data.conversations.forEach(user => {
            users.set(user.id, user);
        });

        // Ajouter les utilisateurs suivis, s'ils ne sont pas déjà dans la liste
        data.following.forEach(user => {
            if (!users.has(user.id)) {
                users.set(user.id, user);
            }
        });

        // Générer la liste des utilisateurs avec leur photo de profil
        const usersArray = Array.from(users.values());

        listeConversation.innerHTML = (await Promise.all(usersArray.map(async (user) => {
            const profilePicUrl = await getProfilePictureUrl(user.username);
            return `
                <li>
                    <button class="btn nomListeConversation d-flex align-items-center" 
                            data-user-id="${user.id}" 
                            onclick="HistoriqueMessages(${user.id}, '${user.username}')">
                        
                        <img width="30px" height="30px" 
                            src="${profilePicUrl}" 
                            class="rounded-circle" 
                            id="profilePictureLiveChatList">

                        <p class="flex-grow-1 d-flex align-items-center justify-content-center m-0">${user.username}</p>
                    </button>
                </li>
            `;
        }))).join('');

    } catch (error) {
        console.error('Erreur lors de la récupération des abonnements :', error);
    }
}

// Fonction pour gérer la recherche en temps réel
function handleSearchInput(event) {
	const query = event.target.value.trim(); // Récupère la valeur du champ de recherche
	const userListContainer = document.getElementById('userListContainer');

	if (query.length > 0) {
		console.log("Recherche en cours : ", query); // Vérifie si la valeur de recherche est récupérée correctement
		fetchUsers(query); // Appelle la fonction pour récupérer les utilisateurs
	} else {
		console.log("Recherche vide");
		userListContainer.innerHTML = ''; // Efface les résultats affichés
	}
}

// Fonction pour récupérer la liste des utilisateurs via l'API
function fetchUsers(query = '') {
	console.log("Envoi de la requête avec la recherche :", query);
	fetch(`/api/utilisateurs/?search=${query}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			'X-CSRFToken': getCsrfToken(), // Ajoutez votre token CSRF ici si nécessaire
		},
	})
	.then(response => response.json())
	.then(data => {
		console.log("Réponse de l'API :", data); // Vérifier la réponse de l'API
		displayUserList(data);  // Affiche les utilisateurs dans la liste
	})
	.catch(error => {
		console.error('Erreur lors de la récupération des utilisateurs:', error);
	});
}

// Fonction pour afficher la liste des utilisateurs
function displayUserList(users) {
	console.log("Affichage de la liste des utilisateurs :", users);  // Vérifier les utilisateurs récupérés
	const userListContainer = document.getElementById('userListContainer');
	userListContainer.innerHTML = '';  // Réinitialiser la liste avant d'ajouter les nouveaux résultats
	
	if (users.length === 0) {
		userListContainer.innerHTML = '<p id="choix-conversation"> Aucun utilisateur trouvé.</p>';
		return;
	}

	// Créez un élément HTML pour chaque utilisateur
	users.forEach(user => {
		console.log("utilisateur individuel : ", user.username, ", id : ", user.id);
		const userElement = document.createElement('div');
		userElement.classList.add('user-item');
		userElement.innerHTML = `
			<p id="choix-conversation" data-user-id="${user.id}" onclick="HistoriqueMessages(${user.id}, '${user.username}')">
				${user.username}
			</p>
		`;
		userListContainer.appendChild(userElement);
	});
}

// Affiche l'historique des messages d'une conversation
// charge les données depuis l'API,
// met à jour l'interface avec les informations du destinataire et les messages
// Si aucune conversation n'est trouvée, affiche un message approprié.
function HistoriqueMessages(id, destinataireUsername) {
	enTeteConv = document.getElementById('en-tete-conversation-live-chat');
	envoieOuBloque = document.getElementById('envoie-ou-message-bloque');
	conversationLiveChat = document.getElementById('conversation-live-chat');
	console.log("username : ", destinataireUsername, " id : ", id);
	document.getElementById('liste-amis-live-chat').style.display = 'none';
	conversationLiveChat.style.display = 'block';
	enTeteConv.innerHTML = '';
	envoieOuBloque.innerHTML = '';
	document.getElementById('message-container').innerHTML = '';

	fetch(`/api/messageHistory/${id}/`)
	.then(response => response.json())
	.then(data => {
		if (data.messages && Array.isArray(data.messages)) {
			destinataireId = id;
			afficherHistoriqueMessages(data.messages);
			affichageConversation(id, destinataireUsername, data);
			scrollToBottom();
		} else if (data.noConversation) {
			destinataireId = id;
			affichageConversation(id, destinataireUsername, data);
		} else {
			destinataireId = null;
			console.log("destinataireId = null");
			console.error("Les messages ne sont pas disponibles ou ne sont pas dans le bon format.");
		}
	})
	.catch(error => {
		destinataireId = null;
			console.log("destinataireId = null");
			console.error('Erreur lors du chargement de l\'historique des messages :', error);
	});
}

// Met à jour l'en-tête de la conversation avec le nom du destinataire
// et un bouton pour voir son profil
// Gère l'affichage des boutons pour bloquer ou débloquer un utilisateur en fonction de l'état de blocage,
// et affiche un champ de message pour envoyer des messages si aucune restriction n'est en place
function affichageConversation(id, destinataireUsername, data) {
	enTeteConv.innerHTML = `
		<button class="btn img-button" onclick="listeAmisLiveChat()">
			<img src="/static/images/icons8-arrière-52-vert.png" alt="Retour">
		</button>
		<h6 id="nom-contact-live-chat">${destinataireUsername}</h6>
		<p class="liveChat-online-offline-Status" id="${data.destinataire_onlineStatus ? 'liveChat-onlineStatus' : 'liveChat-offlineStatus'}">
			${data.destinataire_onlineStatus ? 'en ligne' : 'hors ligne'}
		</p>
		<button class="bouton-liveChat" id="view-profile-btn-from-liveChat" class="btn btn-sm custom-btn view-profile" 
			data-user-id="${id}"
			onclick="handleViewProfile(event)">Voir profil
		</button>
	`;
	const viewProfileButtonFromLiveChat = enTeteConv.querySelector('#view-profile-btn-from-liveChat');
	viewProfileButtonFromLiveChat.addEventListener('click', handleViewProfile);

	if (data["1bloque2"] === true) {
		enTeteConv.innerHTML += `
			<button class="bouton-liveChat" id="bouton-bloquer" onclick="debloquerUtilisateur(${id}, '${destinataireUsername}')">Débloquer</button>
		`;
		envoieOuBloque.innerHTML = `
			<p>Vous avez bloqué ${destinataireUsername}, vous ne pouvez plus lui envoyer de messages.</p>
		`;
	} else if (data["2bloque1"] === true) {
		enTeteConv.innerHTML += `
			<button class="bouton-liveChat" id="bouton-bloquer" onclick="bloquerUtilisateur(${id}, '${destinataireUsername}')">Bloquer</button>
		`;
		envoieOuBloque.innerHTML = `
			<p>${destinataireUsername} vous a bloqué, vous ne pouvez plus lui envoyer de messages.</p>
		`;
	} else {
		enTeteConv.innerHTML += `
			<button class="bouton-liveChat" id="bouton-bloquer" onclick="bloquerUtilisateur(${id}, '${destinataireUsername}')">Bloquer</button>
		`;
		envoieOuBloque.innerHTML = `
			<div id="chatFooter">
				<input type="text" id="messageInput" placeholder="Entrez votre message">
				<button class="bouton-liveChat" id="boutonEnvoieMessage">Envoyer</button>
				<button class="bouton-liveChat" id="inviterPartiePong" onclick="inviterPartiePong(${id})">Partie</button>
			</div>
		`;

		const boutonEnvoieMessage = document.getElementById('boutonEnvoieMessage');
		const messageInput = document.getElementById('messageInput');

		boutonEnvoieMessage.addEventListener('click', function() {
			const message = messageInput.value;
			if (message) {
				chatSocket.send(JSON.stringify({
					'type': "send_message",
					'message': message,
					'destinataire_id': destinataireId
				}));
			}
		messageInput.value = ''; // Vide le champ de saisie
		});
	}
}

// Affiche l'historique des messages en vidant d'abord le conteneur,
// puis en ajoutant chaque message avec un style spécifique (message normal ou invitation de jeu).
// Les messages sont distingués entre expéditeur et destinataire.
function afficherHistoriqueMessages(messages) {
	const messageContainer = document.getElementById('message-container');
	if (!messageContainer) {
		console.error("Le conteneur de messages n'a pas été trouvé !");
		return;
	}

	// Vider le conteneur avant d'ajouter les nouveaux messages
	messageContainer.innerHTML = '';

	messages.forEach(message => {
		if (message.style === "message") {
				const messageElement = document.createElement('div');
				if (message.expediteur_id === destinataireId) {
					messageElement.classList.add('message-destinataire');
				}
				else {
					messageElement.classList.add('message-expediteur');
				}
				messageElement.textContent = `${message.expediteur_username}: ${message.message}`;
				messageContainer.appendChild(messageElement);	
		}
		else if (message.style === "jeu") {
			invitationJeu(message);
		}
		else {
			console.error("erreur lors de l'affichage de l'historique");
		}
	});
}

// Bloque un utilisateur en envoyant une requête POST au serveur,
// puis envoie un message via WebSocket pour notifier le blocage
// Si l'opération réussit, l'historique des messages est mis à jour
// et un message de confirmation est affiché.
function bloquerUtilisateur(idDestinataire, destinataireUsername) {
	fetch(`/bloquer-utilisateur/${idDestinataire}/`, {
		method: 'POST',
		headers: {
			'X-CSRFToken': getCsrfToken('csrftoken'),
			'Content-Type': 'application/json',
		},
	})
	.then(response => {
		console.log("Statut HTTP:", response.status);
		return response.text();  // Lire la réponse en texte brut pour debug
	})
	.then(text => {
		console.log("Réponse brute du serveur:", text);
		
		let data;
		try {
			data = JSON.parse(text);  // Tente de parser le texte en JSON
		} catch (error) {
			console.error("Erreur JSON:", error);
			return;  // Stoppe l'exécution si le JSON est invalide
		}
	
		if (data.error) {
			console.error(data.error);
			alert(data.error);
		} else {
			chatSocket.send(JSON.stringify({
				'type': "block_user",
				'block_type': "bloqueur",
				'destinataire_id': idDestinataire
			}));
	
			console.log(data.message);
			alert(data.message);
			HistoriqueMessages(idDestinataire, destinataireUsername);
		}
	})
	.catch(error => console.error('Erreur Fetch:', error));	
}

// Débloque un utilisateur en envoyant une requête POST au serveur,
// puis envoie un message via WebSocket pour notifier le déblocage.
// Si l'opération réussit, l'historique des messages est mis à jour
// et un message de confirmation est affiché.
function debloquerUtilisateur(idDestinataire, destinataireUsername) {
	fetch(`/debloquer-utilisateur/${idDestinataire}/`, {
		method: 'POST',
		headers: {
			'X-CSRFToken': getCsrfToken('csrftoken'),
			'Content-Type': 'application/json',
		},
	})
	.then(response => response.json())
	.then(data => {
		if (data.error) {
			console.error(data.error);
			alert(data.error);
		} else {
			chatSocket.send(JSON.stringify({
				'type': "block_user",  // Type d'événement correct
				'block_type': "bloqué",  // Fix du champ
				'destinataire_id': idDestinataire
			}));
			console.log(data.message);
			alert(data.message);
			HistoriqueMessages(idDestinataire, destinataireUsername)
		}
	})
	.catch(error => console.error('Erreur:', error));
}

// Fonction pour défiler en bas
function scrollToBottom() {
	const messageContainer = document.getElementById("message-container");

	// Vérifier si l'élément existe
	if (messageContainer) {
		messageContainer.scrollTop = messageContainer.scrollHeight;
	} else {
		console.error("L'élément #messageContainer est introuvable !");
	}
}

// gestion de la modale liveChat
liveChatLink = document.getElementById('liveChatLink');
liveChatModal = document.getElementById('liveChatModal');

// Gestionnaire pour le clic sur le lien liveChat
liveChatLink.addEventListener('click', (e) => {
	e.preventDefault();
	pushModalState6();
	openLiveChatModal();
});

function pushModalState6() {
	console.log("[pushModalState] : '/liveChat'");
	// Sauvegarde le chemin actuel avant de le modifier
	previousPath = window.location.pathname;
	// Ajoute le nouvel état dans l'historique
	history.pushState(
		{
			modal: 'liveChat',
			previousPath: previousPath
		},
		'',
		'/liveChat'
	);
}

function closeModal6() {
	console.log("[closeModal6]");
	const modal = bootstrap.Modal.getInstance(liveChatModal);
	if (modal) {
		modal.hide();
		destinataireId = null;
	}
}

// Gestionnaire pour la navigation dans l'historique
window.addEventListener('popstate', (event) => {
	if (event.state && event.state.modal === 'liveChat') {
		openLiveChatModal();
	} else {
		closeModal6();
	}
});

// Gestionnaire pour la fermeture du modal
liveChatModal.addEventListener('hidden.bs.modal', () => {
	console.log("[liveChatModal.addEventListener('hidden.bs.modal'] : '/liveChat'");
	if (window.location.pathname === '/liveChat') {
		destinataireId = null;
		// Au lieu de history.back(), on push un nouvel état
		const targetPath = previousPath || '/';
		history.pushState(
			{
				modal: null,
				previousPath: '/liveChat'
			},
			'',
			targetPath
		);
	}
});

// Gestion de l'état initial
if (window.location.pathname === '/liveChat') {
	history.replaceState(
		{
			modal: 'liveChat',
			previousPath: '/'
		},
		'',
		'/liveChat'
	);
	openLiveChatModal();
}

function openLiveChatModal() {
	const modal = new bootstrap.Modal(liveChatModal);
	listeAmisLiveChat();
	modal.show();
}