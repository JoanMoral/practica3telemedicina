
console.log("main cargado");



const ubi_select =document.getElementById('ubicacion');
const mod_select = document.getElementById('modelo');
const est_select = document.getElementById('estado');
const cat_select = document.getElementById('categoria');

const ubi_select2 = document.getElementById('ubicacion_rec');
const mod_select2 = document.getElementById('modelo_rec');
const est_select2 = document.getElementById('estado_rec');
const cat_select2 = document.getElementById('categoria_rec');

const renyas_tabla = document.getElementById("lista_resenyas");
const reservas_tabla = document.getElementById("lista_reservas");

var recurso_actual_id = null;
// ws.js - cliente gestor
var conexionWS = null;
var nombre_gestor_ws = null;
var id_gestor_ws = null;

// --- INICIO DEL PARCHE AUTOMÁTICO DE TOKEN ---
var _restGet = rest.get;
var _restPost = rest.post;
var _restPut = rest.put;
var _restDelete = rest.delete;

function anadirToken(url) {
    var token = window.tokenGlobal || "";
    if (!token) return url;
    var separador = url.includes("?") ? "&" : "?";
    return url + separador + "token=" + token;
}

rest.get = function(url, callback) {
    return _restGet.call(rest, anadirToken(url), callback);
};
rest.post = function(url, datos, callback) {
    return _restPost.call(rest, anadirToken(url), datos, callback);
};
rest.put = function(url, datos, callback) {
    return _restPut.call(rest, anadirToken(url), datos, callback);
};
rest.delete = function(url, callback) {
    return _restDelete.call(rest, anadirToken(url), callback);
};
// --- FIN DEL PARCHE ---

function conectarWS(id, nombre) {
    id_gestor_ws = id;
    nombre_gestor_ws = nombre;

    conexionWS = new WebSocket("ws://localhost:4444", "avisos");

    conexionWS.addEventListener("open", function() {
        console.log("Ya estoy conectado con el servidor");
        // Identificarse como gestor
        conexionWS.send(JSON.stringify({
            operacion: "identificar",
            tipo: "gestor",
            id: id,
            nombre: nombre
        }));
    });

    conexionWS.addEventListener("message", function(msg) {
        var datos = JSON.parse(msg.data);
        if (datos.operacion === "aviso") {
            anyadirAviso(datos);
        }
    });
}

function desconectarWS() {
    if (conexionWS) {
        conexionWS.close();
        conexionWS = null;
    }
}

function anyadirAviso(datos) {
    var tabla = document.getElementById("lista_avisos");
    var fila = document.createElement("tr");

    if (datos.color === "verde") fila.style.backgroundColor = "#90ee90";
    else if (datos.color === "rojo") fila.style.backgroundColor = "#ff9999";
    else if (datos.color === "azul") fila.style.backgroundColor = "#9999ff";

    var tdFecha = document.createElement("td");
    tdFecha.textContent = datos.fecha;
    var tdOrigen = document.createElement("td");
    tdOrigen.textContent = datos.origen;
    var tdTexto = document.createElement("td");
    tdTexto.textContent = datos.texto;

    fila.appendChild(tdFecha);
    fila.appendChild(tdOrigen);
    fila.appendChild(tdTexto);
    tabla.appendChild(fila);
}

// Para enviar aviso de nuevo recurso (llamado desde main.js)
function wsAvisoNuevoRecurso(nombreCategoria, nombreModelo, codigoRecurso) {
    if (!conexionWS) return;
    conexionWS.send(JSON.stringify({
        operacion: "avisoNuevoRecurso",
        nombreCategoria: nombreCategoria,
        nombreModelo: nombreModelo,
        codigoRecurso: codigoRecurso,
        quien: nombre_gestor_ws
    }));
}
document.addEventListener("DOMContentLoaded", function(){

    cargarCategorias();
    cargarModelos();
    cargarUbis();
    cargarEstados();
// para que los modelos se actualicen una vez elijamos categorÃ­a.
    cat_select.addEventListener("change", function(){
            actualizarModelos();
        });
    cat_select2.addEventListener("change", function(){
            actualizarModelos();
        });
// cuando se cargue todo el html, ejecutamos las funciones para cargar los selects de inicio.


});

function anyadir(){
    recurso_actual_id = null; // IMPORTANTE
    cambiarSeccion("recurso");

    document.getElementById("num_serie_rec").value = "";
    document.getElementById("modelo_rec").selectedIndex = 0;
    document.getElementById("categoria_rec").selectedIndex = 0;
    document.getElementById("ubicacion_rec").selectedIndex = 0;
    document.getElementById("estado_rec").selectedIndex = 0;
    document.getElementById("lista_reservas").innerHTML = "";
    document.getElementById("lista_resenyas").innerHTML = "";

    inicializarSelectsRecurso();
}
function inicializarSelectsRecurso() {
    // Rellenar categorï¿½as (igual que en el selector principal)
    cat_select2.innerHTML = '<option value="">Seleccione categorï¿½a</option>';
    categorias_lista.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nombre;
        cat_select2.appendChild(opt);
    });
    
    // Rellenar ubicaciones
    ubi_select2.innerHTML = '<option value="">Seleccione ubicaciï¿½n</option>';
    ubis_lista.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.id;
        opt.textContent = u.nombre;
        ubi_select2.appendChild(opt);
    });
    
    // Rellenar estados
    const estados = [
        { id: 0, nombre: "Operativo" },
        { id: 1, nombre: "De baja/defectuoso" },
        { id: 2, nombre: "En mantenimiento" },
    ];
    
    est_select2.innerHTML = '<option value="">Seleccione estado</option>';
    estados.forEach(e => {
        const option = document.createElement("option");
        option.value = e.id;
        option.textContent = e.nombre;
        est_select2.appendChild(option);
    });
    
    // Modelos vacï¿½o inicialmente (se llenarï¿½ al seleccionar categorï¿½a)
    mod_select2.innerHTML = '<option value="">Primero seleccione categorï¿½a</option>';
}
//Para cargar los selects, el cliente necesita conocer las categorias, modelos, ubis...
function cargarCategorias(){
    rest.get("/api/categorias", function(estado,respuesta){
        if(estado == 200){
            categorias_lista = respuesta; //guardamos las categorÃ­as.
            rellenarCategorias();
        }
    });
}

function cargarModelos(){
    rest.get("/api/modelos", function(estado,respuesta){
        if(estado == 200){
            modelos_lista = respuesta; //guardamos los modelos.
        }
    });
}

function cargarUbis(){
    rest.get("/api/ubicaciones", function(estado,respuesta){
        if(estado == 200){
            ubis_lista = respuesta; //guardamos las ubicaciones.
            rellenarUbicaciones();
        }
    });
}
function cargarEstados() {

    const estados = [
        { id: 0, nombre: "Operativo" },
        { id: 1, nombre: "De baja/defectuoso" },
        { id: 2, nombre: "En mantenimiento" },

    ];

    est_select.innerHTML = '<option value="">Seleccione estado</option>';

    estados.forEach(e => {
        const option = document.createElement("option");
        option.value = e.id;
        option.textContent = e.nombre;
        est_select.appendChild(option);

    });
    const todos = document.createElement("option");
    todos.textContent = "Todos";
    todos.value = "Todos";
    est_select.appendChild(todos);
}

function rellenarCategorias(){
    // ponemos en el select un option "decorativo"
    cat_select.innerHTML = '<option value="">Seleccione categorï¿½a</option>';
    categorias_lista.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nombre;
        cat_select.appendChild(opt); //para cada categoria, creamos un option y lo aÃ±adimos al select.

    });
    const todos = document.createElement("option");
    todos.textContent = "Todos";
    todos.value = "Todos";
    cat_select.appendChild(todos);
}
//hacemos lo mismo con las ubis.
function rellenarUbicaciones(){
    ubi_select.innerHTML = '<option value="">Seleccione ubicaciï¿½n</option>';
    ubis_lista.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.id;
        opt.textContent = u.nombre;
        ubi_select.appendChild(opt);


    });
    const todos = document.createElement("option");
    todos.textContent = "Todos";
    todos.value = "Todos";
    ubi_select.appendChild(todos); 
}
function actualizarModelos(){

    var categoriaSeleccionada = document.getElementById("categoria").value;
    var categoriaSeleccionada2 = document.getElementById("categoria_rec").value;
    mod_select.innerHTML = '<option value="">Seleccione modelo</option>';
    mod_select2.innerHTML = '<option value="">Seleccione modelo</option>';
    // ponemos en los selects los option de los modelos que pertenecen a las categorias seleccionadas.
    modelos_lista.forEach(m => {
        if(m.categoria == categoriaSeleccionada){
            var opt = document.createElement("option");
            opt.value = m.id;
            opt.textContent = m.nombre;
            mod_select.appendChild(opt);
        }
    });
    modelos_lista.forEach(m => {
        if(m.categoria == categoriaSeleccionada2){
            var opt = document.createElement("option");
            opt.value = m.id;
            opt.textContent = m.nombre;
            mod_select2.appendChild(opt);
        }
    })
    const todos = document.createElement("option");
    todos.textContent = "Todos";
    todos.value = "Todos";
    mod_select.appendChild(todos);
}

var seccionActual = "login";
var gestor_identificador = "";

    
    var modelos_lista =  [];
    var ubis_lista = [];
    var categorias_lista = [];
    var recurso = [];


    function login(){ // al darle al botÃ³n, puedes ir a una vista u otra
    gestor = {        //eso depende de la respuesta del servidor, por lo que hay peticiÃ³n.
        usuario : document.getElementById("usuario").value,
        password : document.getElementById("password").value
    };
    
    rest.post("/api/gestores/login", gestor, function(estado, respuesta){
        if(estado == 200){
            window.tokenGlobal = respuesta.token;
            // Guardar el identificador del gestor (solo el ID)
            gestor_identificador = respuesta.usuario; // respuesta es el ID del gestor
            
            // Ahora obtener los datos completos del gestor usando el ID
            rest.get("/api/gestores/" + gestor_identificador, function(estado, respuesta) {
                if(estado == 200) {
                    // respuesta contiene: {id, nombre, apellidos, usuario}
                    var nombreCompleto = respuesta.nombre + " " + (respuesta.apellidos || "");
                    
                    // Guardar en una variable global para usarla despuï¿½s
                    window.nombreGestorCompleto = nombreCompleto;

                    conectarWS(gestor_identificador, nombreCompleto); //Mandamos para que se conecte al WebSocket
                    
                    // Cambiar a la secciï¿½n de inicio
                    cambiarSeccion("inicio");
                    
                    // Cargar todos los datos necesarios
                    cargarModelos();
                    cargarUbis();
                    cargarCategorias();
                    cargarRanking();
                    
                    // Mostrar el nombre del gestor
                    document.getElementById("nombre_gestor").textContent = nombreCompleto;
                } else {
                    // Si falla la obtenciï¿½n de datos, al menos mostrar el usuario
                    window.nombreGestorCompleto = document.getElementById("usuario").value;
                    cambiarSeccion("inicio");
                    cargarModelos();
                    cargarUbis();
                    cargarCategorias();
                    cargarRanking();
                    document.getElementById("nombre_gestor").textContent = window.nombreGestorCompleto;
                }
            });
        } else {
            alert("Error en login: " + (respuesta.error || "Credenciales incorrectas"));
        }
    });
}
    function registro(){
    var gestor = {
        nombre: document.getElementById("nombre_reg").value,
        apellidos: document.getElementById("apellidos_reg").value,
        usuario: document.getElementById("usuario_reg").value,
        password: document.getElementById("contrasenya_reg").value,
    };

    if(gestor.nombre!="" && gestor.apellidos!="" && gestor.usuario!="" && gestor.password!=""){

    if(gestor_identificador === ""){ //no ha hecho nunca login, si lo hubiera hecho, tendrÃ­a guardado el id.
        // REGISTRO NUEVO
        rest.post("/api/gestores", gestor, function (estado, respuesta) {
            console.log(respuesta)
            if (estado == 201) {
                window.tokenGlobal = null;
                cambiarSeccion("login");
            } else {
                alert("Error introduciendo nuevo gestor");
            }
        });
    } else { //si ya ha hecho login, haremos una modificaciÃ³n de datos, no creacion (put)
        // EDICIï¿½N - Primero obtener los datos actuales del gestor. Para luego ver que vista ponemos.
        rest.get("/api/gestores/" + gestor_identificador, function(estado, respuesta) {
            if (estado == 200) {
                var gestorActual = respuesta;
                
                // Comparar usuario y contraseï¿½a actuales con los nuevos
                var usuarioCambiado = (gestorActual.usuario !== gestor.usuario);
                var passwordCambiado = (gestorActual.password !== gestor.password); // Asumiendo que la respuesta incluye la password
                
                // Hacer la peticiï¿½n PUT para actualizar
                rest.put("/api/gestores/" + gestor_identificador, gestor, function (estado, respuesta) {
                    if (estado == 201) {
                        // Si cambiï¿½ usuario o contraseï¿½a, redirigir a login
                        if (usuarioCambiado || passwordCambiado) {
                            alert("Usuario o contraseï¿½a modificados. Por favor, inicie sesiï¿½n nuevamente.");
                            gestor_identificador = ""; // Limpiar el identificador
                            window.tokenGlobal = null;
                            cambiarSeccion("login");
                        } else {
                            // Si no cambiaron credenciales, volver al inicio
                            cambiarSeccion("inicio");
                        }
                    } else {
                        alert("Error editando gestor");
                    }
                });
            } else {
                alert("Error obteniendo datos del gestor");
            }
        });
    }
}
else{
    alert("Rellene todos los campos.");
    cambiarSeccion("datos_gestor");
}
}

    function cancelar(){
        if(gestor_identificador != ""){
            cambiarSeccion("inicio")
        }else{
            window.tokenGlobal = null;
            cambiarSeccion("login");
        }
    }
    
    function editar(){
        cambiarSeccion("datos_gestor");
    }
//TODO LO QUE DEPENDA DE LA RESPUESTA DEL SERVIDOR: TIENE QUE IR EN EL CALLBACK.
    function buscar(){
        console.log("entro a buscar");
        var num_serie = "";
        var categoria = document.getElementById("categoria").value;
        console.log(categoria);
        var modelo = document.getElementById("modelo").value;
        var ubicacion = document.getElementById("ubicacion").value;
        var estado = document.getElementById("estado").value
        console.log("numero serie")
        console.log("Entro en la funciÃ³n.")
        rest.get("/api/recursos?categoria="+categoria+"&modelo="+modelo+"&ubicacion="+ubicacion+"&estado="+estado,function(estado,respuesta){
        //le pedimos al servidor que nos devuelva la lista de recursos filtrada.
            var recursos_mostrar = respuesta;
            console.log("RECURSOS RECIBIDOS:", recursos_mostrar); // <-- Aï¿½ADE ESTO
            console.log("Primer recurso:", recursos_mostrar[0]);
            //tienen que ser iguales que los .query que hay en el servidor
            var lista = document.getElementById("lista_recursos");
            lista.innerHTML=""; // aquÃ­ no tiene un value (<tbody>value</tbody>), tiene contenido. 
            // tenemos que utilizar las funciones de carga para tener acceso a todos modelos , categorias y demÃ¡s.
            for(var i = 0;i < recursos_mostrar.length;i++){
                var tr = document.createElement("tr"); //creamos una fila.
                var td_numserie = document.createElement("td"); //columna.
                td_numserie.textContent = recursos_mostrar[i].numero_serie; // podrÃ­a poner directamente el que introduce.
                tr.appendChild(td_numserie);
                // MODELO + CATEGORIA
                var td_modelo = document.createElement("td");
                var td_categoria = document.createElement("td");

                var modelo_id = recursos_mostrar[i].modelo;
                var modelo_obj = null;

                // Buscar modelo UNA sola vez
                for(var j = 0; j < modelos_lista.length; j++){
                    if(modelos_lista[j].id == modelo_id){
                        modelo_obj = modelos_lista[j];
                }
            }

            if(modelo_obj != null){

                td_modelo.textContent = modelo_obj.nombre;

                // Buscar categoria
                for(var k = 0; k < categorias_lista.length; k++){
                    if(categorias_lista[k].id == modelo_obj.categoria){
                        td_categoria.textContent = categorias_lista[k].nombre;
                    }
                }
            }

            tr.appendChild(td_categoria);
            tr.appendChild(td_modelo);
                var td_ubi = document.createElement("td");
                var ubi_id = recursos_mostrar[i].ubicacion; // la respuesta nos da los ids, no el nombre.
                for(var j = 0; j < ubis_lista.length;j++){
                    if(ubi_id == ubis_lista[j].id){ //ids Ãºnicos.
                        td_ubi.textContent = ubis_lista[j].nombre;
                        console.log("entra en ubi");
                    }
                }
                tr.appendChild(td_ubi);
                var td_estado = document.createElement("td")
                var estado_id = recursos_mostrar[i].estado;
                if(estado_id == 0){
                    td_estado.textContent = "Operativo"
                }else if(estado_id == 1){
                    td_estado.textContent = "De baja/defectuoso."
                }else{
                    td_estado.textContent = "En mantenimiento"
                }
                tr.appendChild(td_estado);
                var boton_abrir = document.createElement("button")
                let identificador_recurso = recursos_mostrar[i].id;
                boton_abrir.addEventListener("click",function(){ //addEventListener se ejecuta con el click, y para ese momento el for ha acabado por tanto se guarda el id.
                    abrir(identificador_recurso);
                })
                boton_abrir.textContent = "Abrir";
                tr.appendChild(boton_abrir);
                var boton_eliminar = document.createElement("button")
                boton_eliminar.textContent = "X"
                boton_eliminar.addEventListener("click",function(){
                    eliminarRecurso(identificador_recurso);
                })
                tr.appendChild(boton_eliminar);


                lista.appendChild(tr);
            }
        })

    }
    function eliminarRecurso(id){
        rest.delete("/api/recursos/"+id,function(estado,respuesta){
            if(estado == 200){
                alert("Recurso eliminado");
                buscar();
            }else{
                console.log("ERrro")
            }

        })

        

    }

    

    function cambiarSeccion(seccion){
    document.getElementById(seccionActual).classList.remove("activa");
    document.getElementById(seccion).classList.add("activa");
    seccionActual=seccion;
    if (seccion === "inicio" && window.nombreGestorCompleto) {
        var nombreElement = document.getElementById("nombre_gestor");
        if (nombreElement) {
            nombreElement.textContent = window.nombreGestorCompleto;
        }
    }
    }
    function iniciar_registro(){ // al darle al botÃ³n solo queremos que cambie de vista.
        gestor_identificador = "";
        
        cambiarSeccion("datos_gestor");

        //LIMPIAMOS TODOS LOS CAMPOS
        document.getElementById("nombre_reg").value = "";
        document.getElementById("apellidos_reg").value = "";
        document.getElementById("usuario_reg").value = "";
        document.getElementById("contrasenya_reg").value = "";

    }
    function salir(){
        gestor_identificador = "";
        //LIMPIAMOS LOS CAMPOS
        document.getElementById("usuario").value = "";
        document.getElementById("password").value = "";
        desconectarWS(); // Cuando te salgas habrÃ¡ que desconectarlo del WS.
        lista_avisos.innerHTML = ""; // Limpiar avisos al salir
        document.getElementById("lista_ranking").innerHTML = "";
        window.tokenGlobal = null;
        cambiarSeccion("login");
    }
 function abrir(id){
    var id_recurso = id;
    recurso_actual_id = id;
    cambiarSeccion("recurso");
    
    rest.get("/api/recursos/"+id, function(estado, respuesta){
        if(estado == 200){
            console.log(respuesta.numero_serie);
            
            // Limpiar todos los selects
            ubi_select2.innerHTML = "";
            cat_select2.innerHTML = "";
            mod_select2.innerHTML = "";
            est_select2.innerHTML = "";
            
            // Establecer el nï¿½mero de serie
            document.getElementById("num_serie_rec").value = respuesta.numero_serie;
            
            // Encontrar la categorï¿½a del modelo actual
            var categoria_actual = null;
            for(var i = 0; i < modelos_lista.length; i++){
                if(modelos_lista[i].id == respuesta.modelo){
                    categoria_actual = modelos_lista[i].categoria;
                    break;
                }
            }
            
            // 1. RELLENAR CATEGORï¿½AS (todas)
            for(var i = 0; i < categorias_lista.length; i++){
                var opt = document.createElement("option");
                opt.value = categorias_lista[i].id;
                opt.textContent = categorias_lista[i].nombre;
                
                // Marcar como selected si es la categorï¿½a actual
                if(categorias_lista[i].id == categoria_actual){
                    opt.selected = true;
                }
                
                cat_select2.appendChild(opt);
            }
            
            // 2. RELLENAR MODELOS (todos los de la categorï¿½a actual)
            for(var i = 0; i < modelos_lista.length; i++){
                if(modelos_lista[i].categoria == categoria_actual){
                    var opt = document.createElement("option");
                    opt.value = modelos_lista[i].id;
                    opt.textContent = modelos_lista[i].nombre;
                    
                    // Marcar como selected si es el modelo actual
                    if(modelos_lista[i].id == respuesta.modelo){
                        opt.selected = true;
                    }
                    
                    mod_select2.appendChild(opt);
                }
            }
            
            // 3. RELLENAR UBICACIONES (todas)
            for(var i = 0; i < ubis_lista.length; i++){
                var opt = document.createElement("option");
                opt.value = ubis_lista[i].id;
                opt.textContent = ubis_lista[i].nombre;
                
                // Marcar como selected si es la ubicaciï¿½n actual
                if(ubis_lista[i].id == respuesta.ubicacion){
                    opt.selected = true;
                }
                
                ubi_select2.appendChild(opt);
            }
            
            // 4. RELLENAR ESTADOS (todos)
            var estados_aux = [
                {id: 0, nombre: "Operativo"},
                {id: 1, nombre: "De baja/defectuoso"},
                {id: 2, nombre: "En mantenimiento"}
            ];
            
            for(var i = 0; i < estados_aux.length; i++){
                var opt = document.createElement("option");
                opt.value = estados_aux[i].id;
                opt.textContent = estados_aux[i].nombre;
                
                // Marcar como selected si es el estado actual
                if(estados_aux[i].id == respuesta.estado){
                    opt.selected = true;
                }
                
                est_select2.appendChild(opt);
            }
            
            // Cargar reservas y reseï¿½as
            rellenarReservas(id_recurso);
            rellenarResenyas(id_recurso);
        }
    });
}
    function rellenarReservas(id){
        var lista_reservas = [];
        //necesitamos conocer las reservas de un recurso.
        rest.get("/api/recursos/"+id+"/reservas",function(estado,respuesta){
            if(estado == 200){
                lista_reservas = respuesta;
                reservas_tabla.innerHTML = "";
                console.log("lista reservas" +lista_reservas);
                for(var i = 0 ; i < lista_reservas.length; i++){ // un mismo recurso, puede tener varias reservas.
                    
                    var fila = document.createElement("tr") // hacemos esto para cada reserva del recurso.
                    var sanitario = document.createElement("td");
                    sanitario.textContent = lista_reservas[i].sanitario;
                    fila.appendChild(sanitario);
                    var horas = document.createElement("td");
                    horas.textContent = lista_reservas[i].horas_estimadas;
                    fila.appendChild(horas);
                    var fecha_pet = document.createElement("td");
                    fecha_pet.textContent = lista_reservas[i].fecha_peticion;
                    fila.appendChild(fecha_pet);
                    var fecha_ini = document.createElement("td");
                    fecha_ini.textContent = lista_reservas[i].fecha_inicio;
                    fila.appendChild(fecha_ini);
                    var fecha_end = document.createElement("td");
                    fecha_end.textContent = lista_reservas[i].fecha_fin;
                    fila.appendChild(fecha_end);
                    if(lista_reservas[i].fecha_fin == null && lista_reservas[i].fecha_inicio == null){
                        fila.style.backgroundColor = "green";
                    }else if(lista_reservas[i].fecha_fin == null){
                        fila.style.backgroundColor = "blue";
                    }
                    reservas_tabla.appendChild(fila);
                }
            }

        })

    }
    function rellenarResenyas(id){
        var lista_resenyas = []
        rest.get("/api/recursos/"+id+"/resenyas",function(estado,respuesta){
            if(estado == 200){
                lista_resenyas = respuesta;
                renyas_tabla.innerHTML = "";
                console.log("lista resenyas" + lista_resenyas);
                for(var i = 0; i < lista_resenyas.length; i++){ //un mismo recurso puede tener varias resenyas.
                var fila = document.createElement("tr");
                
                var fecha = document.createElement("td");
                fecha.textContent = lista_resenyas[i].fecha;
                fila.appendChild(fecha);
                
                var sanitario = document.createElement("td");
                sanitario.textContent = lista_resenyas[i].sanitario;
                fila.appendChild(sanitario);
                
                var valoracion = document.createElement("td");
                valoracion.textContent = lista_resenyas[i].valor + "/5";
                fila.appendChild(valoracion);
                
                var comentario = document.createElement("td");
                comentario.textContent = lista_resenyas[i].descripcion;
                fila.appendChild(comentario);
                
                
                
                renyas_tabla.appendChild(fila);
            }

            }
    })
}

    function guardar_recurso(){
        var inputNumSerie = document.getElementById("num_serie_rec");
    console.log("INPUT NUMERO SERIE:", inputNumSerie); // ?? ï¿½Existe el elemento?
    console.log("VALOR DEL INPUT:", inputNumSerie.value); // ?? ï¿½Quï¿½ valo

    var recurso = {
        numero_serie : document.getElementById("num_serie_rec").value,
        modelo : document.getElementById("modelo_rec").value,
        ubicacion : document.getElementById("ubicacion_rec").value,
        estado : document.getElementById("estado_rec").value
    };
    console.log(recurso);
    
    



    if(recurso_actual_id != null){ 
        // EDITAR
        rest.put("/api/recursos/" + recurso_actual_id, recurso, function(estado,respuesta){
            if(estado == 201){
                alert("Recurso actualizado");
            }
        });
    } else {
        // CREAR
        rest.post("/api/recursos", recurso, function(estado,respuesta){
            if(estado == 201){
                alert("Recurso creado");
                var modeloObj = modelos_lista.find(m => m.id == recurso.modelo);
                var categoriaObj = categorias_lista.find(c => c.id == modeloObj.categoria); //Cogemos la categoria y el modelo del recurso y lo mandamos por el WS.
                wsAvisoNuevoRecurso(categoriaObj.nombre, modeloObj.nombre, recurso.numero_serie);
            }
        });
    }
}

function volver(){
    cambiarSeccion("inicio");
    //Indicamos que los selects marquen la opciÃ³n por defecto. 
    document.getElementById("categoria").value = "";
    document.getElementById("modelo").value = "";
    document.getElementById("ubicacion").value = "";
    document.getElementById("estado").value = "";
    //los option se mantienen cargados.
    buscar();
    cargarRanking();
}

var URL_MINISTERIO = "https://undefined.ua.es/telemedicina/api/datos"; // ? URL real
var ID_AREA = 3;   // Cardiología

var AREAS = {
    1:"Alergologia", 2:"Anestesiologia", 3:"Cardiologia", 4:"Cirugia General",
    5:"Dermatologia", 6:"Aparato Digestivo", 7:"Endocrinologia", 8:"Ginecologia",
    9:"Hematologia", 10:"Medicina Interna", 11:"Neumologia", 12:"Neurologia",
    13:"Oftalmologia", 14:"Oncologia", 15:"Pediatria", 16:"Psiquiatria",
    17:"Traumatologia", 18:"Urologia"
};

// ---------- Validaciones ----------
function esTextoValido(t){
    return typeof t === "string" && t.trim() !== "";
}

function esFechaValida(f){
    if(typeof f !== "string") return false;
    // Si viene con hora tipo ISO (ej: 2026-02-18T07:00:00.000Z), nos quedamos solo con la fecha YYYY-MM-DD
    if(f.includes("T")) {
        f = f.split("T")[0];
    }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
    var d = new Date(f + "T00:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
}

function esAreaValida(id){
    return Number.isInteger(id) && id >= 1 && id <= 18;
}

// Acepta la clave con o sin tilde al leer datos de otros
function categoriaDe(r){
    return r["categor\u00eda"] !== undefined ? r["categor\u00eda"] : r["categoria"];
}

// fec_ini y fecha_fin pueden ser null (reserva aún sin comenzar/terminar)
function esRegistroValido(r){
    if(r === null || typeof r !== "object") return false;
    if(!esTextoValido(r.nombre) || !esTextoValido(r.apellidos)) return false;
    if(!esTextoValido(categoriaDe(r))) return false;

    var horas = Number(r.horas_estimadas);
    if(r.horas_estimadas === null || r.horas_estimadas === "" || isNaN(horas) || horas < 0) return false;

    if(!esFechaValida(r.fec_pet)) return false;
    if(r.fec_ini != null && !esFechaValida(r.fec_ini)) return false;
    if(r.fecha_fin != null && !esFechaValida(r.fecha_fin)) return false;

    if(r.fec_ini != null && r.fec_ini < r.fec_pet) return false;
    if(r.fec_ini != null && r.fecha_fin != null && r.fecha_fin < r.fec_ini) return false;
    return true;
}

// Acepta [{id_area, datos:[...]}, ...]  o  {"1":[...], "2":[...]}
function normalizarRespuesta(respuesta){
    var salida = [];
    if(Array.isArray(respuesta)){
        respuesta.forEach(function(e){
            if(e && typeof e === "object") salida.push({ id_area: Number(e.id_area), datos: e.datos });
        });
    }else if(respuesta && typeof respuesta === "object"){
        Object.keys(respuesta).forEach(function(k){
            var v = respuesta[k];
            salida.push({ id_area: Number(k), datos: Array.isArray(v) ? v : (v && v.datos) });
        });
    }
    return salida;
}

// Devuelve solo lo bueno, sin duplicados
function filtrarDatosMinisterio(respuesta){
    var limpio = [];
    var vistas = {};
    var descartados = 0;
    normalizarRespuesta(respuesta).forEach(function(e){
        if(!esAreaValida(e.id_area) || !Array.isArray(e.datos)){
            descartados += Array.isArray(e.datos) ? e.datos.length : 1;
            return;
        }
        var buenos = e.datos.filter(function(r){
            if(!esRegistroValido(r)) return false;
            var clave = [e.id_area, r.nombre, r.apellidos, categoriaDe(r),
                         r.fec_pet, r.fec_ini, r.horas_estimadas].join("|");
            if(vistas[clave]) return false;   // duplicado
            vistas[clave] = true;
            return true;
        });
        descartados += e.datos.length - buenos.length;
        if(buenos.length > 0) limpio.push({ id_area: e.id_area, datos: buenos });
    });
    if(descartados > 0) console.warn("Registros descartados del Ministerio:", descartados);
    return limpio;
}

function aplanar(areas) {
    var reservas = [];
    areas.forEach(function(a) {
        a.datos.forEach(function(r) {
            reservas.push(Object.assign({ id_area: a.id_area }, r));
        });
    });
    return reservas;
}

// ---------- Recogida de reservas (solo servicios existentes) ----------
function formatearFecha(f){
    if(f === null || f === undefined || f === "") return null;
    var d = new Date(f);
    if(isNaN(d.getTime())) return null;
    var mes = String(d.getMonth() + 1).padStart(2, "0");
    var dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mes + "-" + dia;
}

function nombreCategoria(idModelo){
    var m = modelos_lista.find(function(x){ return x.id == idModelo; });
    if(!m) return null;
    var c = categorias_lista.find(function(x){ return x.id == m.categoria; });
    return c ? c.nombre : null;
}

function recogerReservas(callback){
    rest.get("/api/recursos?categoria=Todos&modelo=Todos&ubicacion=Todos&estado=Todos", function(estado, recursos){
        if(estado != 200 || !Array.isArray(recursos)){
            callback(null);
            return;
        }
        if(recursos.length == 0){
            callback([]);
            return;
        }

        var todas = [];
        var pendientes = recursos.length;

        recursos.forEach(function(rec){
            rest.get("/api/recursos/" + rec.id + "/reservas", function(estado, reservas){
                if(estado == 200 && Array.isArray(reservas)){
                    console.log("rec:", rec);
                    console.log("modelo de ejemplo:", modelos_lista[0]);
                    console.log("categoria de ejemplo:", categorias_lista[0]);
                    var categoria = nombreCategoria(rec.modelo);
                    reservas.forEach(function(r){
                        todas.push({
                            nombre: r.sanitario_nombre,
                            apellidos: r.sanitario_apellidos,
                            "categoría": categoria,
                            horas_estimadas: r.horas_estimadas,
                            fec_pet: formatearFecha(r.fecha_peticion),
                            fec_ini: formatearFecha(r.fecha_inicio),
                            fecha_fin: formatearFecha(r.fecha_fin)
                        });
                    });
                }
                pendientes--;
                if(pendientes == 0) callback(todas);   // han respondido todas
            });
        });
    });
}

function nombreSolo(reservas,callback){
    var contador = 0;
    var vistas = {};
    for(var i = 0; i < reservas.length; i++){
        var nombre = reservas[i].nombre;
        var apellidos = reservas[i].apellidos;
        var clave = nombre+apellidos;
        if(!vistas[clave]){
            vistas[clave] = true;
            contador++;
        }
    }
    callback(contador); 
}
    

// ---------- Envío ----------
function enviarMinisterio(){
    if(modelos_lista.length == 0 || categorias_lista.length == 0){
        alert("Aún no se han cargado los modelos y categorías, inténtalo de nuevo");
        return;
    }

    recogerReservas(function(reservas){
        console.log("Reservas recogidas:", reservas.length, reservas[0]);
        reservas.slice(0, 3).forEach(function(r){
            console.log({
                nombre: esTextoValido(r.nombre),
                apellidos: esTextoValido(r.apellidos),
                categoria: esTextoValido(categoriaDe(r)),
                horas: r.horas_estimadas,
                fec_pet: esFechaValida(r.fec_pet),
                fec_ini: r.fec_ini,
                fecha_fin: r.fecha_fin
            });
        });
        if(reservas === null){
            alert("Error al obtener los recursos");
            return;
        }

        var datos = reservas.filter(esRegistroValido);   // solo lo bueno
        if(datos.length == 0){
            alert("No hay reservas válidas que enviar");
            return;
        }

        var cuerpo = {
            id_area: ID_AREA,
            fecha: formatearFecha(new Date()),
            datos: datos
        };

        rest.post(URL_MINISTERIO, cuerpo, function(estado, respuesta){
            if(estado == 200 || estado == 201){
                alert("Enviadas " + datos.length + " reservas al Ministerio");
                cargarRanking();
            }else{
                console.log("Respuesta del Ministerio:", estado, respuesta);
                alert("Error al enviar al Ministerio (código " + estado + ")");
            }
        });
    });
}
    

// ---------- Ranking ----------
function cargarRanking(){
    rest.get(URL_MINISTERIO, function(estado, respuesta){
        if(estado != 200) return;
        console.log("Respuesta del Ministerio:", respuesta);

        var datos = filtrarDatosMinisterio(respuesta);
        /*
        var reservas = aplanar(datos);
        document.getElementById("total_reservas").textContent = reservas.length;

        nombreSolo(reservas, function(n) {
            document.getElementById("sanitarios_distintos").textContent = n;
        });
        */

        var conteo = {};
        datos.forEach(function(e){
            conteo[e.id_area] = (conteo[e.id_area] || 0) + e.datos.length;
        });

        var ranking = Object.keys(conteo).map(function(id){
            return { area: AREAS[id], total: conteo[id] };
        }).sort(function(a, b){ return b.total - a.total; });

        var tbody = document.getElementById("lista_ranking");
        tbody.innerHTML = "";
        ranking.forEach(function(item, i){
            var fila = document.createElement("tr");
            [i + 1, item.area, item.total].forEach(function(valor){
                var td = document.createElement("td");
                td.textContent = valor;
                fila.appendChild(td);
            });
            tbody.appendChild(fila);
        });
    });
}

