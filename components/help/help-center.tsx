'use client'

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { sendSupportTicket } from "@/app/actions";
import { 
  Search, 
  ArrowRight, 
  Video, 
  BookOpen, 
  ChevronRight, 
  PlayCircle,
  X,
  FileText
} from "lucide-react";
import { helpArticles, helpCategories, HelpCategory, HelpArticle } from "@/lib/help-content";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface HelpCenterProps {
  userRole: string;
}

export function HelpCenter({ userRole }: HelpCenterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | "Todas">("Todas");
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);

  // Support Ticket State
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    priority: "Media",
    attachment: null as string | null
  });

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setTicketForm(prev => ({ ...prev, attachment: event.target?.result as string }));
            toast.success("Imagen adjuntada desde el portapapeles");
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error("El archivo es demasiado grande (Máx 5MB)");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setTicketForm(prev => ({ ...prev, attachment: event.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingTicket(true);
    
    const formData = new FormData();
    Object.entries(ticketForm).forEach(([key, value]) => {
      if (value !== null) {
        formData.append(key, value);
      }
    });
    
    try {
      const result = await sendSupportTicket(formData);
      if (result.success) {
        toast.success("Ticket enviado correctamente. Nos pondremos en contacto pronto.");
        setIsTicketOpen(false);
        setTicketForm({ name: "", email: "", subject: "", message: "", priority: "Media", attachment: null });
        console.log("[TRACKING] Support Ticket Sent", { ...ticketForm, timestamp: new Date().toISOString() });
      } else {
        toast.error(result.error || "Error al enviar el ticket.");
        console.error("[TRACKING] Support Ticket Error", result.error);
      }
    } catch (error) {
      toast.error("Ocurrió un error inesperado. Intente nuevamente.");
      console.error("[TRACKING] Support Ticket Exception", error);
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  // Filter articles based on role, search query, and category
  const filteredArticles = useMemo(() => {
    return helpArticles.filter(article => {
      // 1. Role Check
      if (!article.roles.includes(userRole)) return false;

      // 2. Category Check
      if (selectedCategory !== "Todas" && article.category !== selectedCategory) return false;

      // 3. Search Check
      if (searchQuery.trim() === "") return true;
      
      const query = searchQuery.toLowerCase();
      return (
        article.title.toLowerCase().includes(query) ||
        article.description.toLowerCase().includes(query) ||
        article.tags.some(tag => tag.toLowerCase().includes(query)) ||
        article.content.toLowerCase().includes(query)
      );
    });
  }, [userRole, searchQuery, selectedCategory]);

  // Get categories that have at least one visible article for this user
  const visibleCategories = useMemo(() => {
    const categoriesWithContent = new Set(
      helpArticles
        .filter(a => a.roles.includes(userRole))
        .map(a => a.category)
    );
    return helpCategories.filter(c => categoriesWithContent.has(c.id));
  }, [userRole]);

  return (
    <div className="flex flex-col space-y-8 min-h-screen bg-transparent">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 border border-slate-800 p-8 md:p-12 text-center shadow-2xl">
        <div className="absolute inset-0 bg-[url('/img/grid-pattern.svg')] opacity-10" />
        <div className="relative z-10 flex flex-col items-center max-w-3xl mx-auto space-y-6">
          <Badge variant="outline" className="border-sky-400/70 text-sky-200 px-4 py-1 rounded-full text-sm font-medium bg-sky-500/10 backdrop-blur-sm">
            Centro de Soporte 2026
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-sm">
            ¿Cómo podemos <span className="text-sky-300">ayudarle</span> hoy?
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl font-medium">
            Explore nuestra base de conocimiento actualizada con guías, tutoriales y recursos para dominar la plataforma SG-SST-IA.
          </p>
          
          {/* Search Bar */}
          <div className="relative w-full max-w-2xl mt-8 group">
            <div className="absolute -inset-1 bg-gradient-to-r from-sky-500/25 to-sky-500/0 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative flex items-center bg-white border border-slate-200 rounded-full shadow-lg p-1 transition-all focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20">
              <Search className="h-5 w-5 text-slate-400 ml-4" />
              <Input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar guías, tutoriales, problemas..." 
                className="flex-1 border-0 bg-transparent text-slate-900 placeholder:text-slate-500 focus-visible:ring-0 h-12 px-4 text-base font-medium"
              />
              {searchQuery && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSearchQuery("")}
                  className="mr-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button className="rounded-full bg-sky-500 text-white hover:bg-sky-600 font-bold px-6 h-10 mr-1 transition-transform active:scale-95 shadow-sm">
                Buscar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Navigation */}
      <div className="flex flex-wrap gap-2 justify-center pb-4 border-b border-slate-200">
        <Button
          variant={selectedCategory === "Todas" ? "default" : "outline"}
          onClick={() => setSelectedCategory("Todas")}
          className={cn(
            "rounded-full px-6 transition-all font-medium",
            selectedCategory === "Todas" 
              ? "bg-sky-500 text-white hover:bg-sky-600 border-transparent shadow-md" 
              : "bg-white border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50"
          )}
        >
          Todas
        </Button>
        {visibleCategories.map((cat) => (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              "rounded-full px-6 transition-all font-medium",
              selectedCategory === cat.id
                ? "bg-sky-500 text-white hover:bg-sky-600 border-transparent shadow-md"
                : "bg-white border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50"
            )}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Articles Grid */}
      {filteredArticles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
          {filteredArticles.map((article) => {
            const Icon = article.icon || BookOpen;
            
            return (
              <div 
                key={article.id} 
                className="group relative flex flex-col bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-sky-500/50 transition-all duration-300 cursor-pointer overflow-hidden"
                onClick={() => setSelectedArticle(article)}
              >
                {/* Hover Glow Effect */}
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl group-hover:bg-sky-500/10 transition-all duration-500" />
                
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 group-hover:border-sky-500/30 transition-colors">
                    <Icon className="h-6 w-6 text-sky-600" />
                  </div>
                  {article.videoUrl && (
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0">
                      <PlayCircle className="h-3 w-3 mr-1" /> Video
                    </Badge>
                  )}
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-sky-700 transition-colors line-clamp-2">
                  {article.title}
                </h3>
                
                <p className="text-slate-600 text-sm mb-4 line-clamp-2 flex-grow font-medium">
                  {article.description}
                </p>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 group-hover:border-slate-200 transition-colors">
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                    {article.category}
                  </span>
                  <div className="flex items-center text-sm font-semibold text-slate-700 group-hover:text-sky-700 transition-colors">
                    Leer guía
                    <ArrowRight className="h-4 w-4 ml-2 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 border border-slate-200 mb-4">
            <Search className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No se encontraron resultados</h3>
          <p className="text-slate-600 max-w-md mx-auto">
            Intente ajustar su búsqueda o seleccione otra categoría.
          </p>
          <Button 
            variant="link" 
            onClick={() => { setSearchQuery(""); setSelectedCategory("Todas"); }}
            className="text-sky-700 mt-4 font-semibold"
          >
            Limpiar filtros
          </Button>
        </div>
      )}

      {/* Support CTA */}
      <div className="mt-12 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700 p-8 md:p-12 text-center relative overflow-hidden shadow-xl">
        <div className="absolute inset-0 bg-[url('/img/noise.png')] opacity-5 mix-blend-overlay"></div>
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            ¿Necesita asistencia personalizada?
          </h2>
          <p className="text-slate-200 mb-8 text-lg">
            Nuestro equipo de expertos está disponible para resolver sus dudas técnicas o administrativas.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => setIsTicketOpen(true)}
              className="bg-sky-500 text-white hover:bg-sky-600 h-12 px-8 rounded-full text-base font-bold shadow-[0_0_20px_rgba(56,189,248,0.20)] hover:shadow-[0_0_30px_rgba(56,189,248,0.35)] transition-all"
            >
              Abrir Ticket de Soporte
            </Button>
            <Button 
              variant="outline" 
              asChild
              className="bg-transparent border-white/30 text-white hover:bg-white hover:text-slate-900 h-12 px-8 rounded-full text-base font-medium backdrop-blur-sm transition-all duration-300"
              onClick={() => console.log("[TRACKING] Email Contact Clicked", { timestamp: new Date().toISOString() })}
            >
              <a href="mailto:pmdsoporte@gmail.com?subject=Solicitud%20de%20Soporte%20SG-SST-IA">
                Contactar por Email
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Support Ticket Modal */}
      <Dialog open={isTicketOpen} onOpenChange={setIsTicketOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white text-slate-900 border-slate-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-900">Abrir Ticket de Soporte</DialogTitle>
            <DialogDescription className="text-slate-500">
              Complete el siguiente formulario y nuestro equipo le responderá a la brevedad posible.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleTicketSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-700">Nombre</Label>
                <Input 
                  id="name" 
                  value={ticketForm.name} 
                  onChange={(e) => setTicketForm({...ticketForm, name: e.target.value})}
                  required 
                  placeholder="Su nombre"
                  className="bg-white border-slate-200 text-slate-900 focus-visible:ring-sky-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={ticketForm.email} 
                  onChange={(e) => setTicketForm({...ticketForm, email: e.target.value})}
                  required 
                  placeholder="nombre@empresa.com"
                  className="bg-white border-slate-200 text-slate-900 focus-visible:ring-sky-500"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-slate-700">Asunto</Label>
              <Input 
                id="subject" 
                value={ticketForm.subject} 
                onChange={(e) => setTicketForm({...ticketForm, subject: e.target.value})}
                required 
                placeholder="Resumen del problema"
                className="bg-white border-slate-200 text-slate-900 focus-visible:ring-sky-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority" className="text-slate-700">Prioridad</Label>
              <Select 
                value={ticketForm.priority} 
                onValueChange={(value) => setTicketForm({...ticketForm, priority: value})}
              >
                <SelectTrigger className="bg-white border-slate-200 text-slate-900 focus:ring-sky-500">
                  <SelectValue placeholder="Seleccione prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baja">Baja</SelectItem>
                  <SelectItem value="Media">Media</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message" className="text-slate-700">Mensaje</Label>
              <div className="relative">
                <Textarea 
                  id="message" 
                  value={ticketForm.message} 
                  onChange={(e) => setTicketForm({...ticketForm, message: e.target.value})}
                  onPaste={handlePaste}
                  required 
                  placeholder="Describa su solicitud en detalle... (Puede pegar capturas de pantalla con Ctrl+V)"
                  className="min-h-[120px] bg-white border-slate-200 text-slate-900 focus-visible:ring-sky-500"
                />
                <div className="mt-2 flex items-center gap-2">
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-sky-500/10 file:text-sky-700 hover:file:bg-sky-500/15" 
                  />
                </div>
                {ticketForm.attachment && (
                  <div className="mt-2 relative inline-block border border-slate-200 rounded-lg overflow-hidden">
                    <img src={ticketForm.attachment} alt="Adjunto" className="h-20 w-auto object-cover" />
                    <button 
                      type="button"
                      onClick={() => setTicketForm(prev => ({ ...prev, attachment: null }))}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsTicketOpen(false)}
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmittingTicket}
                className="bg-sky-500 text-white hover:bg-sky-600 font-bold"
              >
                {isSubmittingTicket ? "Enviando..." : "Enviar Ticket"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Article Viewer Modal */}
      <Dialog open={!!selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border-slate-200 text-slate-900 p-0 gap-0 shadow-2xl">
          {selectedArticle && (
            <>
              <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-100 p-6 flex items-start justify-between">
                <div>
                  <Badge variant="outline" className="mb-2 border-sky-500/70 text-sky-700 bg-sky-500/5 font-semibold">
                    {selectedArticle.category}
                  </Badge>
                  <DialogTitle className="text-2xl font-bold text-slate-900">
                    {selectedArticle.title}
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 mt-1">
                    Última actualización: {selectedArticle.updatedAt}
                  </DialogDescription>
                </div>
                {/* Close button is automatically added by DialogContent usually, but can be customized */}
              </div>
              
              <div className="p-6 md:p-8 space-y-8 bg-slate-50/30">
                {selectedArticle.videoUrl && (
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-200 shadow-lg mb-8">
                    <iframe 
                      width="100%" 
                      height="100%" 
                      src={selectedArticle.videoUrl} 
                      title={selectedArticle.title}
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                )}
                
                <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700 prose-strong:text-slate-900 prose-a:text-sky-700">
                  <ReactMarkdown
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-3xl font-bold text-slate-900 mb-6 border-b border-slate-200 pb-4" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-2xl font-semibold text-slate-900 mt-8 mb-4 flex items-center" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-xl font-medium text-sky-700 mt-6 mb-3" {...props} />,
                      p: ({node, ...props}) => <p className="text-slate-700 leading-relaxed mb-4 text-base" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc list-outside ml-6 space-y-2 text-slate-700 mb-6" {...props} />,
                      li: ({node, ...props}) => <li className="pl-1" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-semibold text-slate-900" {...props} />,
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-sky-500 pl-4 italic text-slate-600 bg-sky-50 py-3 pr-4 rounded-r my-6 shadow-sm" {...props} />,
                      a: ({node, ...props}) => <a className="text-sky-700 font-medium hover:underline underline-offset-4 hover:text-sky-900" {...props} />,
                      code: ({node, ...props}) => <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-sm font-mono border border-slate-200" {...props} />,
                    }}
                  >
                    {selectedArticle.content}
                  </ReactMarkdown>
                </div>
                
                {/* Tags */}
                <div className="pt-8 mt-8 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wider">Etiquetas</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedArticle.tags.map(tag => (
                      <span key={tag} className="text-xs bg-white text-slate-600 px-3 py-1 rounded-full border border-slate-200 shadow-sm font-medium hover:border-sky-500 hover:text-sky-700 transition-colors cursor-default">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-slate-200 p-4 flex justify-end shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <Button
                  onClick={() => setSelectedArticle(null)}
                  className="bg-slate-900 text-white hover:bg-slate-800 hover:text-white focus-visible:ring-slate-900/40 font-medium px-6"
                >
                  Cerrar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
