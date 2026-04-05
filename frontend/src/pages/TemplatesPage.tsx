import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { templatesApi, mediaApi } from "@/api";
import { notifyApp } from "@/lib/notifications";
import { formatDate } from "@/lib/utils";
import { Plus, Copy, Pencil, Trash2, Upload, ImageIcon } from "lucide-react";

const templateSchema = z.object({
  name: z.string().min(2),
  category: z.string().optional(),
  language: z.string().default("en"),
  bodyText: z.string().min(1),
  headerType: z.string().optional(),
  headerContent: z.string().optional(),
  footerText: z.string().optional(),
  metaTemplateName: z.string().optional(),
});

type TemplateForm = z.infer<typeof templateSchema>;

interface Template {
  id: string;
  name: string;
  category?: string | null;
  language: string;
  bodyText?: string | null;
  headerType?: string | null;
  headerContent?: string | null;
  footerText?: string | null;
  metaTemplateName?: string | null;
  status: string;
  createdAt: string;
}

interface TemplateEditSnapshot {
  id: string;
  name: string;
  category?: string | null;
  language: string;
  bodyText?: string | null;
  headerType?: string | null;
  headerContent?: string | null;
  footerText?: string | null;
  metaTemplateName?: string | null;
}

function safeText(value?: string | null): string {
  return value && value.trim().length > 0 ? value.trim() : "(empty)";
}

export default function TemplatesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<TemplateEditSnapshot | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: templatesApi.list,
  });

  const saveMutation = useMutation({
    mutationFn: (values: TemplateForm) =>
      editingTemplateId
        ? templatesApi.update(editingTemplateId, values as Record<string, unknown>)
        : templatesApi.create(values as Record<string, unknown>),
    onSuccess: (result: Template, values: TemplateForm) => {
      const templateName = values.name?.trim() || result.name;
      let description = `[Templates > Create]\nTemplate: ${templateName}\nLanguage: ${values.language || result.language}`;

      if (editingTemplateId && editingSnapshot) {
        const changes: string[] = [];
        const nextName = safeText(values.name);
        const nextCategory = safeText(values.category);
        const nextLanguage = safeText(values.language);
        const nextBody = safeText(values.bodyText);
        const nextHeader = safeText(values.headerContent);
        const nextFooter = safeText(values.footerText);
        const nextMetaName = safeText(values.metaTemplateName);

        if (safeText(editingSnapshot.name) !== nextName) changes.push(`Name: ${safeText(editingSnapshot.name)} -> ${nextName}`);
        if (safeText(editingSnapshot.category) !== nextCategory) changes.push(`Category: ${safeText(editingSnapshot.category)} -> ${nextCategory}`);
        if (safeText(editingSnapshot.language) !== nextLanguage) changes.push(`Language: ${safeText(editingSnapshot.language)} -> ${nextLanguage}`);
        if (safeText(editingSnapshot.bodyText) !== nextBody) changes.push(`Body: ${safeText(editingSnapshot.bodyText)} -> ${nextBody}`);
        if (safeText(editingSnapshot.headerContent) !== nextHeader) changes.push(`Header: ${safeText(editingSnapshot.headerContent)} -> ${nextHeader}`);
        if (safeText(editingSnapshot.footerText) !== nextFooter) changes.push(`Footer: ${safeText(editingSnapshot.footerText)} -> ${nextFooter}`);
        if (safeText(editingSnapshot.metaTemplateName) !== nextMetaName) changes.push(`Meta Name: ${safeText(editingSnapshot.metaTemplateName)} -> ${nextMetaName}`);

        description = `[Templates > Edit]\nTemplate: ${safeText(editingSnapshot.name)} -> ${nextName}\n${changes.length > 0 ? changes.join("\n") : "Saved without field changes."}`;
      }

      notifyApp({
        title: editingTemplateId ? "Template Updated" : "Template Created",
        description,
        kind: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      reset();
      setShowCreate(false);
      setEditingTemplateId(null);
      setEditingSnapshot(null);
    },
    onError: (error: unknown, values) => {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (error instanceof Error ? error.message : "Template save failed.");
      notifyApp({
        title: editingTemplateId ? "Template Update Failed" : "Template Create Failed",
        description: `[Templates > ${editingTemplateId ? "Edit" : "Create"}]\nTemplate: ${values.name || "Template"}\nError: ${message}`,
        kind: "error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => templatesApi.remove(id),
    onSuccess: (_result, variables) => {
      notifyApp({
        title: "Template Deleted",
        description: `[Templates > Delete]\nTemplate: ${variables.name}`,
        kind: "warning",
      });
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (error: unknown, variables) => {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (error instanceof Error ? error.message : "Template delete failed.");
      notifyApp({
        title: "Template Delete Failed",
        description: `[Templates > Delete]\nTemplate: ${variables.name}\nError: ${message}`,
        kind: "error",
      });
    },
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema),
  });

  const beginEditTemplate = (template: Template) => {
    reset({
      name: template.name,
      category: template.category ?? "",
      language: template.language,
      bodyText: template.bodyText ?? "",
      headerType: template.headerType ?? "",
      headerContent: template.headerContent ?? "",
      footerText: template.footerText ?? "",
      metaTemplateName: template.metaTemplateName ?? "",
    });
    setEditingTemplateId(template.id);
    setEditingSnapshot({
      id: template.id,
      name: template.name,
      category: template.category,
      language: template.language,
      bodyText: template.bodyText,
      headerType: template.headerType,
      headerContent: template.headerContent,
      footerText: template.footerText,
      metaTemplateName: template.metaTemplateName,
    });
    setShowCreate(true);
  };

  return (
    <AppLayout title="Templates">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground text-sm">
            Build reusable message templates with variable substitution and randomization.
          </p>
          <Button
            onClick={() => {
              if (showCreate) {
                setShowCreate(false);
                setEditingTemplateId(null);
                setEditingSnapshot(null);
                reset();
                return;
              }
              setShowCreate(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            {showCreate ? "Close" : "New Template"}
          </Button>
        </div>

        {showCreate && (
          <Card>
            <CardHeader><CardTitle>Create Template</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label>Template Name</Label>
                    <Input {...register("name")} placeholder="Summer Offer" />
                  </div>
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Input {...register("category")} placeholder="marketing" />
                  </div>
                  <div className="space-y-1">
                    <Label>Language</Label>
                    <Input {...register("language")} defaultValue="en" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Header Type</Label>
                    <select
                      {...register("headerType")}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">None</option>
                      <option value="text">Text</option>
                      <option value="image">Image</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>{watch("headerType") === "image" ? "Image" : "Header Text"}</Label>
                    {watch("headerType") === "image" ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            {...register("headerContent")}
                            placeholder="https://example.com/image.jpg"
                            className="flex-1"
                          />
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                setUploading(true);
                                const result = await mediaApi.upload(file);
                                setValue("headerContent", result.url);
                                notifyApp({ title: "Image Uploaded", description: result.originalName, kind: "success" });
                              } catch (err) {
                                const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Upload failed";
                                notifyApp({ title: "Upload Failed", description: msg, kind: "error" });
                              } finally {
                                setUploading(false);
                                if (fileInputRef.current) fileInputRef.current.value = "";
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                          >
                            {uploading ? "Uploading..." : <><Upload className="w-4 h-4 mr-1" /> Upload</>}
                          </Button>
                        </div>
                        {watch("headerContent") && watch("headerType") === "image" && (
                          <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate flex-1">{watch("headerContent")}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">Upload an image or paste a public URL (JPEG/PNG/WebP, max 5MB)</p>
                      </div>
                    ) : (
                      <Input
                        {...register("headerContent")}
                        placeholder="Header text"
                        disabled={!watch("headerType")}
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Body Text *</Label>
                  <Textarea {...register("bodyText")} rows={4} placeholder="Hello {{1}}! We have a special offer for you..." />
                  <p className="text-xs text-muted-foreground">Use {"{{1}}"}, {"{{2}}"} etc. for variable substitution.</p>
                  {errors.bodyText && <p className="text-xs text-red-500">{errors.bodyText.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Footer (optional)</Label>
                  <Input {...register("footerText")} placeholder="Reply STOP to opt out" />
                </div>
                <div className="space-y-1">
                  <Label>Meta Template Name (if approved)</Label>
                  <Input {...register("metaTemplateName")} placeholder="hello_world" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreate(false);
                      setEditingTemplateId(null);
                      setEditingSnapshot(null);
                      reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Saving..." : editingTemplateId ? "Update Template" : "Save Template"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>All Templates</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground">{t.category ?? "—"}</TableCell>
                      <TableCell>{t.language}</TableCell>
                      <TableCell>{t.status}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => beginEditTemplate(t)}>
                            <Pencil className="w-3 h-3 mr-1" />Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              if (window.confirm("Delete this template?")) {
                                deleteMutation.mutate({ id: t.id, name: t.name });
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />Delete
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Copy className="w-3 h-3 mr-1" />Clone
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {templates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No templates yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
