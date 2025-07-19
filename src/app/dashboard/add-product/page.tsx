
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useTransition, useMemo } from 'react';
import { Clock, Loader2, Image as ImageIcon, DollarSign, Upload, Trash2, PlusCircle } from 'lucide-react';
import { uploadImage, addProduct } from '@/lib/actions';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { categories } from '@/lib/data';

const categoryNames = categories.map(c => c.name) as [string, ...string[]];
const availableTags = ['Best Value', 'Spicy', 'New'] as const;

const MAX_IMAGES = 4;

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.coerce.number().positive('Price must be a positive number'),
  originalPrice: z.coerce.number().optional(),
  category: z.enum(categoryNames),
  deliveryTime: z.string().min(1, 'Delivery time is required'),
  commissionPercentage: z.coerce.number().min(5).max(10),
  tags: z.array(z.string()).optional(),
  images: z.array(z.any()).min(1, "At least one image is required.").max(MAX_IMAGES, `You can upload a maximum of ${MAX_IMAGES} images.`),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function AddProductPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const canAddProduct = user?.planType === 'pro' || (user?.planType === 'free' && (user?.productUploadCount ?? 0) < 5);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'seller') {
      router.push('/login');
    }
  }, [user, isAuthenticated, router]);
  
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      originalPrice: undefined,
      category: 'Burger',
      deliveryTime: '',
      commissionPercentage: 5,
      tags: [],
      images: [],
    },
  });
  
  const watchedPrice = form.watch('price');
  const watchedOriginalPrice = form.watch('originalPrice');
  const watchedCommission = form.watch('commissionPercentage');

  const sellerReceives = useMemo(() => {
    const price = typeof watchedPrice === 'number' ? watchedPrice : 0;
    const commission = typeof watchedCommission === 'number' ? watchedCommission : 0;
    if (price > 0) {
      return price - (price * (commission / 100));
    }
    return 0;
  }, [watchedPrice, watchedCommission]);

  const discountPercentage = useMemo(() => {
    if (watchedOriginalPrice && watchedPrice && watchedOriginalPrice > watchedPrice) {
      return Math.round(((watchedOriginalPrice - watchedPrice) / watchedOriginalPrice) * 100);
    }
    return 0;
  }, [watchedPrice, watchedOriginalPrice]);
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const currentFiles = form.getValues('images') || [];
    const totalFiles = currentFiles.length + files.length;
    
    if (totalFiles > MAX_IMAGES) {
      toast({
        title: "Maximum images reached",
        description: `You can only upload up to ${MAX_IMAGES} images.`,
        variant: "destructive",
      });
      return;
    }
    
    const newFiles = [...currentFiles, ...files];
    form.setValue('images', newFiles, { shouldValidate: true });

    const newPreviews = [...imagePreviews];
    files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
            newPreviews.push(reader.result as string);
            if (newPreviews.length === newFiles.length) {
              setImagePreviews(newPreviews);
            }
        };
        reader.readAsDataURL(file);
    });
  };
  
  const removeImage = (indexToRemove: number) => {
    const currentFiles = form.getValues('images').filter((_, index) => index !== indexToRemove);
    form.setValue('images', currentFiles, { shouldValidate: true });
    
    const newPreviews = imagePreviews.filter((_, index) => index !== indexToRemove);
    setImagePreviews(newPreviews);
  };

  const handleSubmit = (data: ProductFormValues) => {
    if (!user || !canAddProduct) return;
    
    startSubmitTransition(async () => {
      try {
          const imageUrls = await Promise.all(
            data.images.map(async (imageFile) => {
              const formData = new FormData();
              formData.append('image', imageFile);
              const uploadResult = await uploadImage(formData);
              if (uploadResult.error || !uploadResult.url) {
                throw new Error(uploadResult.error || 'Image upload failed');
              }
              return uploadResult.url;
            })
          );
          
          const productData = { ...data, images: imageUrls };
          const result = await addProduct(productData, user.id);

          if (result.error) {
              throw new Error(result.error);
          }

          toast({ title: 'Product Added!', description: `${data.name} has been successfully added.` });
          router.push('/dashboard');
      } catch (error: any) {
          console.error("Failed to add product:", error);
          toast({ title: 'Error', description: error.message || 'Failed to add product. Please try again.', variant: 'destructive' });
      }
    });
  };

  if (!user || user.role !== 'seller') {
      return <div className="container py-12 text-center">Loading or redirecting...</div>;
  }
  
  if (!canAddProduct) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="container mx-auto py-12 text-center"
      >
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl text-destructive">Upload Limit Reached</CardTitle>
                    <CardDescription>You have reached the maximum number of product uploads for the free plan.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="mb-4">Please upgrade to the Pro plan to add more products.</p>
                    <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
                </CardContent>
            </Card>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto py-12"
    >
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Add a New Product</CardTitle>
          <CardDescription>Fill out the form below to list a new item in your shop.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              
              <FormField
                control={form.control}
                name="images"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-lg font-semibold">Product Images</FormLabel>
                    <FormDescription>Add up to {MAX_IMAGES} images. The first image is the main one.</FormDescription>
                    <FormControl>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        {imagePreviews.map((preview, index) => (
                           <div key={index} className="relative aspect-square group">
                            <Image
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              layout="fill"
                              objectFit="cover"
                              className="rounded-md border"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                onClick={() => removeImage(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                           </div>
                        ))}
                        {imagePreviews.length < MAX_IMAGES && (
                          <Label
                            htmlFor="image-upload"
                            className="cursor-pointer aspect-square flex flex-col items-center justify-center rounded-md border-2 border-dashed hover:border-primary hover:bg-accent transition-colors"
                          >
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <span className="mt-2 text-sm text-muted-foreground">Add Image</span>
                          </Label>
                        )}
                       </div>
                    </FormControl>
                    <Input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isSubmitting || imagePreviews.length >= MAX_IMAGES}
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Classic Beef Burger" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Product Description</FormLabel>
                      <FormControl>
                      <Textarea placeholder="Describe your product..." {...field} disabled={isSubmitting} rows={5}/>
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categoryNames.map(name => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                 <FormField
                    control={form.control}
                    name="deliveryTime"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Est. Delivery Time</FormLabel>
                        <FormControl>
                        <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="e.g. 20-30 mins" {...field} className="pl-10" disabled={isSubmitting}/>
                        </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>

               <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="font-semibold text-lg">Pricing & Offers</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="originalPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Original Price (BDT)</FormLabel>
                            <FormControl>
                                <div className="relative">
                                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input type="number" placeholder="e.g. 400" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} value={field.value ?? ''} className="pl-10" disabled={isSubmitting}/>
                                </div>
                            </FormControl>
                             <FormDescription>Optional: for showing a discount.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Selling Price (BDT)</FormLabel>
                            <FormControl>
                                <div className="relative">
                                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input type="number" placeholder="e.g. 350" {...field} className="pl-10" disabled={isSubmitting}/>
                                </div>
                            </FormControl>
                            <FormDescription>This is the final price.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                  </div>
                  {discountPercentage > 0 && (
                     <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
                        <p className="font-medium">Discount Offer: <span className="font-bold text-lg">{discountPercentage}% OFF</span></p>
                        <p className="text-xs">Customers will see the original price struck through.</p>
                     </div>
                  )}
              </div>
              
              <FormField
                control={form.control}
                name="tags"
                render={() => (
                  <FormItem className="space-y-4 rounded-lg border p-4">
                    <div>
                      <FormLabel className="text-lg font-semibold">Product Tags</FormLabel>
                      <FormDescription>
                        Select tags that apply to your product.
                      </FormDescription>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {availableTags.map((item) => (
                        <FormField
                          key={item}
                          control={form.control}
                          name="tags"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={item}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(item)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), item])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== item
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {item}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                  <FormField
                      control={form.control}
                      name="commissionPercentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commission Rate</FormLabel>
                          <Select onValueChange={(v) => field.onChange(parseInt(v))} defaultValue={String(field.value)} disabled={isSubmitting}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a commission rate" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="5">5%</SelectItem>
                              <SelectItem value="7">7%</SelectItem>
                              <SelectItem value="10">10%</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     {sellerReceives > 0 && (
                        <div className="p-3 rounded-md bg-green-900/50 border border-green-500/50 text-green-300">
                            <p className="font-medium">You will receive: <span className="font-bold">৳{sellerReceives.toFixed(2)}</span></p>
                            <p className="text-xs">After {watchedCommission}% commission.</p>
                        </div>
                    )}
              </div>


              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Adding Product...' : 'Add Product'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
