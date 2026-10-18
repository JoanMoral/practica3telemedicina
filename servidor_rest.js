var express = require("express");
var jwt = require("jwt-simple");
var clave = "miSecretoMasOscuro";
// 1. Importar el cliente de Supabase
const { createClient } = require('@supabase/supabase-js');

// 2. Configurar con tu URL y tu Public Key (anon key)
const supabaseUrl = 'https://lzppwupubkayrzmmknsg.supabase.co';
const supabaseKey = 'sb_publishable_Ri7xDq7bjmM3K3D575zjrQ_4B2FzKzP'; // <--- Pega aquí tu public key
const supabase = createClient(supabaseUrl, supabaseKey);

var app = express();
app.listen(3000);
app.use("/gestor", express.static("cliente_rest"));
app.use("/sanitario", express.static("cliente_rpc"));
app.use(express.json());

// Código de error de PostgreSQL para violación de restricción UNIQUE
var PG_UNIQUE_VIOLATION = "23505";

// ---------- Middleware JWT: protege todo /api salvo login y registro ----------
app.use("/api", function (req, res, next) {

    // Acceso libre para hacer login o registrarse (POST /api/gestores)
    if (req.path === "/gestores/login" || (req.path === "/gestores" && req.method === "POST")) {
        return next();
    }

    var token = req.query.token;
    if (!token) {
        res.status(401).json("No se ha encontrado token");
        return;
    }

    var contenidoToken;
    try {
        contenidoToken = jwt.decode(token, clave);
    } catch (error) {
        res.status(401).json("El token es incorrecto");
        return;
    }

    if (!contenidoToken || !contenidoToken.expira || !contenidoToken.usuario) {
        res.status(401).json("El formato del token no es adecuado");
        return;
    }

    if (contenidoToken.expira < Date.now()) {
        res.status(401).json("El token ha expirado");
        return;
    }

    next();
});

// ---------- Catálogos ----------
async function listarTabla(tabla, res) {
    var { data, error } = await supabase.from(tabla).select("*");
    if (error) {
        console.log("Error al realizar la select", error);
        return res.status(500).json("Error al realizar la consulta");
    }
    res.status(200).json(data);
}

app.get("/api/ubicaciones", function (req, res) { listarTabla("ubicaciones", res); });
app.get("/api/categorias", function (req, res) { listarTabla("categorias", res); });
app.get("/api/modelos", function (req, res) { listarTabla("modelos", res); });

// ---------- Gestores y sanitarios ----------
async function obtenerPersona(tabla, req, res) {
    var { data, error } = await supabase
        .from(tabla)
        .select("id, nombre, apellidos, usuario")
        .eq("id", req.params.id)
        .maybeSingle();
    if (error) {
        console.log("Error al realizar el select", error);
        return res.status(500).json("Error al realizar la consulta");
    }
    if (!data) {
        return res.status(404).json("No se ha encontrado");
    }
    res.status(200).json(data);
}

app.get("/api/gestores/:id", function (req, res) { obtenerPersona("gestores", req, res); });
app.get("/api/sanitarios/:id", function (req, res) { obtenerPersona("sanitarios", req, res); });

// ---------- Recursos ----------
app.get("/api/recursos/:id", async function (req, res) {
    var { data, error } = await supabase
        .from("recursos")
        .select("*")
        .eq("id", req.params.id)
        .maybeSingle();
    if (error) {
        console.log("Error al realizar el select", error);
        return res.status(500).json("Error al realizar la consulta");
    }
    if (!data) {
        return res.status(404).json("No se ha encontrado");
    }
    res.status(200).json(data);
});

// Reservas de un recurso, con nombre y apellidos del sanitario. Devuelve [] si no hay.
app.get("/api/recursos/:id/reservas", async function (req, res) {
    var { data, error } = await supabase
        .from("reservas")
        .select("id, horas_estimadas, fecha_peticion, fecha_inicio, fecha_fin, sanitarios!inner(nombre, apellidos)")
        .eq("recurso", req.params.id);
    if (error) {
        console.log("Error al realizar el select", error);
        return res.status(500).json("Error al realizar la consulta");
    }
    var reservas = data.map(function (r) {
        return {
            id: r.id,
            sanitario: r.sanitarios.nombre,
            sanitario_nombre: r.sanitarios.nombre,
            sanitario_apellidos: r.sanitarios.apellidos,
            horas_estimadas: r.horas_estimadas,
            fecha_peticion: r.fecha_peticion,
            fecha_inicio: r.fecha_inicio,
            fecha_fin: r.fecha_fin
        };
    });
    res.status(200).json(reservas);
});

app.get("/api/recursos/:id/resenyas", async function (req, res) {
    var { data, error } = await supabase
        .from("resenyas")
        .select("fecha, valor, descripcion, sanitarios!inner(nombre)")
        .eq("recurso", req.params.id);
    if (error) {
        console.log("Error al realizar el select", error);
        return res.status(500).json("Error al realizar la consulta");
    }
    var resenyas = data.map(function (r) {
        return {
            fecha: r.fecha,
            sanitario: r.sanitarios.nombre,
            valor: r.valor,
            descripcion: r.descripcion
        };
    });
    res.status(200).json(resenyas);
});

app.get("/api/recursos", async function (req, res) {

    var categoria = req.query.categoria;
    var modelo = req.query.modelo;
    var ubicacion = req.query.ubicacion;
    var estado = req.query.estado;

    // Un filtro solo se aplica si tiene valor y no es "Todos"
    function aplicar(valor) {
        return valor !== undefined && valor !== "" && valor != "Todos";
    }

    // modelos!inner equivale al INNER JOIN con modelos
    var consulta = supabase.from("recursos").select("*, modelos!inner(categoria)");

    if (aplicar(ubicacion)) consulta = consulta.eq("ubicacion", ubicacion);
    if (aplicar(estado)) consulta = consulta.eq("estado", estado);
    if (aplicar(modelo)) consulta = consulta.eq("modelo", modelo);
    if (aplicar(categoria)) consulta = consulta.eq("modelos.categoria", categoria);

    var { data, error } = await consulta;
    if (error) {
        console.log(error);
        return res.status(500).json("Error al realizar la consulta");
    }

    // Equivale a "SELECT r.*": quitamos el objeto modelos añadido por el join
    var recursos = data.map(function (r) {
        var copia = Object.assign({}, r);
        delete copia.modelos;
        return copia;
    });
    res.status(200).json(recursos);
});

app.post("/api/recursos", async function (req, res) {
    var estado = req.body.estado;

    if (estado != 0 && estado != 1 && estado != 2) {
        return res.status(400).json("Estado invalido");
    }

    var { error } = await supabase.from("recursos").insert({
        modelo: req.body.modelo,
        ubicacion: req.body.ubicacion,
        numero_serie: req.body.numero_serie,
        estado: estado
    });

    if (error) {
        if (error.code === PG_UNIQUE_VIOLATION) {
            return res.status(400).json({ error: "Numero de serie ya existe." });
        }
        console.log("Error al insertar el recurso", error);
        return res.status(500).json("Error al realizar la consulta");
    }
    res.status(201).json("Recurso creado");
});

app.put("/api/recursos/:id", async function (req, res) {
    // .select() al final devuelve las filas modificadas, para saber si existía
    var { data, error } = await supabase
        .from("recursos")
        .update({
            numero_serie: req.body.numero_serie,
            modelo: req.body.modelo,
            ubicacion: req.body.ubicacion,
            estado: req.body.estado
        })
        .eq("id", req.params.id)
        .select();

    if (error) {
        if (error.code === PG_UNIQUE_VIOLATION) {
            return res.status(400).json({ error: "Numero de serie ya existe." });
        }
        console.log("Error al actualizar el recurso", error);
        return res.status(500).json("Error al realizar la consulta");
    }
    if (data.length == 0) {
        return res.status(404).json("No se ha encontrado el recurso.");
    }
    res.status(201).json("Se han actualizado los datos.");
});

app.delete("/api/recursos/:id", async function (req, res) {
    var id_recurso = req.params.id;

    var { data, error } = await supabase
        .from("recursos")
        .delete()
        .eq("id", id_recurso)
        .select();

    if (error) {
        console.log("Error al eliminar el recurso", error);
        return res.status(500).json("Error al realizar la consulta");
    }
    if (data.length == 0) {
        return res.status(404).json("No se ha encontrado el recurso con id: " + id_recurso);
    }
    res.status(200).json("El recurso con identificador: " + id_recurso + " ha sido eliminado");
});

// ---------- Gestores: registro, login y edición ----------
app.post("/api/gestores", async function (req, res) {
    var { error } = await supabase.from("gestores").insert({
        nombre: req.body.nombre,
        apellidos: req.body.apellidos,
        usuario: req.body.usuario,
        password: req.body.password
    });

    if (error) {
        if (error.code === PG_UNIQUE_VIOLATION) {
            return res.status(404).json("Usuario no valido");
        }
        console.log("Error al insertar el gestor", error);
        return res.status(500).json("Error al realizar la consulta");
    }
    res.status(201).json("Gestor creado");
});

// Devuelve el token JWT y el id del gestor: { token, usuario }
app.post("/api/gestores/login", async function (req, res) {
    var usuario = req.body.usuario;
    var password = req.body.password;

    var { data, error } = await supabase
        .from("gestores")
        .select("id, password")
        .eq("usuario", usuario)
        .maybeSingle();

    if (error) {
        console.log("Error al realizar el select", error);
        return res.status(500).json("Error al realizar la consulta");
    }
    if (!data) {
        return res.status(403).json({ error: "No existe este usuario." });
    }
    if (data.password !== password) {
        return res.status(403).json({ error: "Credenciales invalidas" });
    }

    var contenido = {
        usuario: data.id,
        expira: Date.now() + 60 * 60 * 1000   // 1 hora
    };
    var token = jwt.encode(contenido, clave);
    res.status(200).json({ token: token, usuario: data.id });
});

app.put("/api/gestores/:id", async function (req, res) {
    var { data, error } = await supabase
        .from("gestores")
        .update({
            nombre: req.body.nombre,
            apellidos: req.body.apellidos,
            usuario: req.body.usuario,
            password: req.body.password
        })
        .eq("id", req.params.id)
        .select();

    if (error) {
        if (error.code === PG_UNIQUE_VIOLATION) {
            return res.status(400).json({ error: "Usuario ya existe" });
        }
        console.log("Error al actualizar el gestor", error);
        return res.status(500).json("Error al realizar la consulta");
    }
    if (data.length == 0) {
        return res.status(404).json("No se ha actualizado la informacion.");
    }
    res.status(201).json("Se han actualizado los datos.");
});